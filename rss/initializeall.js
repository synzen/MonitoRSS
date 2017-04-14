/*
    This is used every time the bot is started
    if there are any enabled feeds. If there are
    no enabled feeds, it will start rss.js
    immediately through server.js.

    The process is:
    1. Retrieve the feed through request
    2. Feedparser sends the feed into an array
    3. Connect to SQL database
    4. Check if table for feed exists

      If table exists:
      5. Filter feed items by maxAge
      6. Send filtered feed items to be checked in table

          If filtered items seen in table
          7. gatherResults() (keep track of processed items)

          If filtered items not seen in table
          8. Send to Discord
          9. Log in table
          10. gatherResults()

      If table doesn't exist:
      6. Create table for feed for that Discord channel
      7. Log all items in feed in table
      8. gatherResults() and close connection
*/
const config = require('../config.json')
const moment = require('moment-timezone')
const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const translator = require('./translator/translate.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const sendToDiscord = require('../util/sendToDiscord.js')
const currentGuilds = require('../util/fetchInterval').currentGuilds

module.exports = function(con, channel, rssName, callback) {
  const feedparser = new FeedParser()
  const currentFeed = []

  const guildRss = currentGuilds.get(channel.guild.id)
  const rssList = guildRss.sources

  requestStream(rssList[rssName].link, feedparser, function(err) {
    if (err) return callback({type: 'request', content: err, feed: rssList[rssName]});
  })

  feedparser.on('error', function(err) {
    feedparser.removeAllListeners('end')
    return callback({type: 'feedparser', content: err, feed: rssList[rssName]})
  });

  feedparser.on('readable', function() {
    let item;

    while (item = this.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {
    // Return if no articles in feed found
    if (currentFeed.length === 0) return callback();

    const totalItems = currentFeed.length
    let processedItems = 0

     // console.log(`RSS Info: (${guildRss.id}, ${guildRss.name}) => Starting default initializion for: ${rssName}`)

    function getArticleId(article) {
      let equalGuids = (currentFeed.length > 1) ? true : false // default to true for most feeds
      if (equalGuids && currentFeed[0].guid) for (var x in currentFeed) {
        if (x > 0 && currentFeed[x].guid != currentFeed[x - 1].guid) equalGuids = false;
      }

      if ((!article.guid || equalGuids) && article.title) return article.title;
      if ((!article.guid || equalGuids) && !article.title && article.pubdate && article.pubdate !== "Invalid Date") return article.pubdate;
      return article.guid;
    }

    function startDataProcessing() {
      checkTableExists()
    }

    function checkTableExists() {
      sqlCmds.selectTable(con, rssName, function(err, results) {
        if (err) throw err;
        if (results.size() === 0) {
          console.log(`RSS Info: Table does not exist for ${rssName}, creating now and initializing all`);
          createTable();
        }
        else {
          const feedLength = currentFeed.length - 1;
          const defaultMaxAge = (config.feedSettings.defaultMaxAge) ? config.feedSettings.defaultMaxAge : 1;
          for (var x = feedLength; x >= 0; x--) { //get feeds starting from oldest, ending with newest.
            const cutoffDay = (rssList[rssName].maxAge) ? moment(new Date()).subtract(rssList[rssName].maxAge, 'd') : moment(new Date()).subtract(defaultMaxAge, 'd');

            if (currentFeed[x].pubdate >= cutoffDay) checkTable(currentFeed[x], getArticleId(currentFeed[x]));
            else if (currentFeed[x].pubdate < cutoffDay || currentFeed[x].pubdate == "Invalid Date") {
              checkTable(currentFeed[x], getArticleId(currentFeed[x]), true);
            }
          }
        }
      })
    }

    function createTable() {
      sqlCmds.createTable(con, rssName, function(err, results) {
        if (err) throw err;
        for (var x in currentFeed) insertIntoTable(getArticleId(currentFeed[x]));
      })
    }

    function checkTable(article, articleId, isOldArticle) {
      sqlCmds.select(con, rssName, articleId, function(err, results) {
        if (err) throw err;
        if (results.size() > 0) gatherResults(); // Already exists in table
        else if (isOldArticle) insertIntoTable(articleId);
        else {
          if (config.feedSettings.sendOldMessages == true) sendToDiscord(rssName, channel, article, false, function(err) { //this can result in great spam once the loads up after a period of downtime
            if (err) console.log(err);
            insertIntoTable(articleId);
          });
          else insertIntoTable(articleId);
        }
      })
    }

    function insertIntoTable(articleId) {
      sqlCmds.insert(con, rssName, articleId, function(err, res){
        if (err) throw err;
        gatherResults();
      })
    }

    function gatherResults() {
      processedItems++;
      if (processedItems === totalItems) {
        callback();
        //console.log(`RSS Info: (${guildRss.id}, ${guildRss.name}) => Finished default initialization for: ${rssName}`)
      }
    }

    return startDataProcessing()
  });
}

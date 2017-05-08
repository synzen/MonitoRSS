/*
    This is used every time the bot is started
    if there are any enabled feeds. If there are
    no enabled feeds, it will start rss.js
    immediately through server.js.

    The process is:
    1. Request link for feed(s) with same destinations
    2. Feedparser sends the feed into an array
    3. Loop through all sources with this particular link and go through the steps below
    4. Verify config for source's guild and the source itself is valid
    5. Check if table for source exists

      If table exists:
      6. Filter feed items by maxAge
      7. Send filtered feed items to be checked in table

          If filtered items seen in table
          8. gatherResults() (keep track of processed items)

          If filtered items not seen in table
          9. Send to Discord
          10. Log in table
          11. gatherResults()

      If table doesn't exist:
      6. Create table for feed for that Discord channel
      7. Log all items in feed in table
      8. gatherResults()
*/
const config = require('../config.json')
const moment = require('moment-timezone')
const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const currentGuilds = require('../util/storage').currentGuilds
const checkGuild = require('../util/checkGuild.js')

module.exports = function(con, link, rssList, uniqueSettings, callback) {
  const feedparser = new FeedParser()
  const currentFeed = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, function(err) {
    if (err) {
      console.log(`${bot.shard ? 'SH ' + bot.shard.id : ''} INIT Error: Skipping ${link}. (${err})`);
      return callback({status: 'failed', link: link, rssList: rssList})
    }
  })

  feedparser.on('error', function(err) {
    feedparser.removeAllListeners('end')
    console.log(`${bot.shard ? 'SH ' + bot.shard.id : ''} INIT Error: Skipping ${link}. (${err})`)
    return callback({status: 'failed', link: link, rssList: rssList})
  });

  feedparser.on('readable', function() {
    let item;

    while (item = this.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {
    // Return if no articles in feed found
    if (currentFeed.length === 0) return callback({status: 'success'});

    const totalItems = currentFeed.length
    let sourcesCompleted = 0

    function getArticleId(article) {
      let equalGuids = (currentFeed.length > 1) ? true : false // default to true for most feeds
      if (equalGuids && currentFeed[0].guid) for (var x in currentFeed) {
        if (x > 0 && currentFeed[x].guid != currentFeed[x - 1].guid) equalGuids = false;
      }

      if ((!article.guid || equalGuids) && article.title) return article.title;
      if ((!article.guid || equalGuids) && !article.title && article.pubdate && article.pubdate !== "Invalid Date") return article.pubdate;
      return article.guid;
    }

    function processSource(rssName) {
      const channelId = rssList[rssName].channel
      checkTableExists()

      let processedItems = 0;

      function checkTableExists() {
        sqlCmds.selectTable(con, rssName, function(err, results) {
          if (err) throw err;
          if (results.size() === 0) {
            console.log(`INIT Info: Table does not exist for ${rssName}, creating now and initializing all`);
            createTable();
          }
          else {
            let idArray = [];
            for (var p in currentFeed) idArray.push(getArticleId(currentFeed[p]))

            sqlCmds.cleanTable(con, rssName, idArray);

            const feedLength = currentFeed.length - 1;
            const defaultMaxAge = (config.feedSettings.defaultMaxAge) ? config.feedSettings.defaultMaxAge : 1;
            for (var x = feedLength; x >= 0; x--) { // Get feeds starting from oldest, ending with newest.
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
          for (var x in currentFeed) insertIntoTable({
            id: getArticleId(currentFeed[x]),
            title: currentFeed[x].title
          });
        })
      }

      function checkTable(article, articleId, isOldArticle) {

        sqlCmds.selectId(con, rssName, articleId, function(err, IdMatches) {
          if (err) throw err;
          if (IdMatches.length > 0) return decideAction(true);
          sqlCmds.selectTitle(con, rssName, article.title, function(err, titleMatches) { // Double check if title exists if ID was not found in table and is apparently a new article
            if (err) throw err;                                                     // Preventing articles with different GUIDs but same titles from sending is a priority
            if (titleMatches.length > 0) return decideAction(true);
            decideAction(false)
          });
        })

        function decideAction(seenArticle) {
          if (seenArticle) return gatherResults(); // Stops here if it already exists in table, AKA "seen"
          if (isOldArticle) {
            return insertIntoTable({ // Stops here if it's unseen but is an old article
              id: articleId,
              title: article.title
            });
          }

          if (config.feedSettings.sendOldMessages == true) {
            article.rssName = rssName;
            article.discordChannelId = channelId;
            callback({status: 'article', article: article})
          }
          insertIntoTable({
            id: articleId,
            title: article.title
          });
        }
      }

      function insertIntoTable(articleInfo) {
        sqlCmds.insert(con, rssName, articleInfo, function(err, res) {
          if (err) throw err;
          gatherResults()
        })
      }

      function gatherResults() {
        processedItems++
        if (processedItems === totalItems) finishSource();
      }
    }

    for (var rssName in rssList) processSource(rssName);

    function finishSource() {
      sourcesCompleted++
      if (sourcesCompleted === rssList.size()) return callback({status: 'success'});
    }
  })
}

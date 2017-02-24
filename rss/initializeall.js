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
const FeedParser = require('feedparser');
const translator = require('./translator/translate.js')
const startFeedSchedule = require('../util/startFeedSchedule.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const sendToDiscord = require('../util/sendToDiscord.js')

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

module.exports = function (con, channel, rssIndex, callback) {
  var feedparser = new FeedParser()
  var currentFeed = []

  var guild = require(`../sources/${channel.guild.id}.json`)
  var rssList = guild.sources

  requestStream(rssList[rssIndex].link, feedparser, function (err) {
    if (err) return callback(err);
  })

  feedparser.on('error', function (err) {
    feedparser.removeAllListeners('end')
    return callback(err)
  });

  feedparser.on('readable',function () {
    var stream = this;
    var item;

    while (item = stream.read()) {
      currentFeed.push(item);
    }
});

  feedparser.on('end', function() {
    if (currentFeed.length == 0) return callback();

    var feedName = rssList[rssIndex].name
    var tableAlreadyExisted = 0
    var processedItems = 0
    var totalItems = currentFeed.length

    console.log(`RSS Info: (${guild.id}, ${guild.name}) => Starting default initializion for: ${feedName}`)

    function getArticleId (article) {
      var equalGuids = (currentFeed.length > 1) ? true : false // default to true for most feeds
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
      sqlCmds.selectTable(con, feedName, function (err, results) {
        if (err) throw err;
        if (isEmptyObject(results)) {
          console.log(`RSS Info: Table does not exist for ${feedName}, creating now and initializing all`);
          createTable();
        }
        else {
          //console.log(`RSS Info: Table already exists for ${feedName}, getting new feeds if exists`)
          tableAlreadyExisted = true;

          let feedLength = currentFeed.length - 1;
          for (var x = feedLength; x >= 0; x--) { //get feeds starting from oldest, ending with newest.
            var cutoffDay;
            var defaultMaxAge = (config.feedSettings.defaultMaxAge) ? config.feedSettings.defaultMaxAge : 1;
            if (!rssList[rssIndex].maxAge) cutoffDay = moment(new Date()).subtract(defaultMaxAge, 'd');
            else cutoffDay = moment(new Date()).subtract(rssList[rssIndex].maxAge, 'd');

            if (currentFeed[x].pubdate >= cutoffDay) checkTable(currentFeed[x], getArticleId(currentFeed[x]));
            else if (currentFeed[x].pubdate < cutoffDay || currentFeed[x].pubdate == "Invalid Date") {
              checkTable(currentFeed[x], getArticleId(currentFeed[x]), true);
            }
          }
        }
      })
    }

    function createTable() {
      sqlCmds.createTable(con, feedName, function (err, results) {
        if (err) throw err;
        for (var x in currentFeed) insertIntoTable(getArticleId(currentFeed[x]));
      })
    }

    function checkTable(article, articleId, isOldArticle) {
      sqlCmds.select(con, feedName, articleId, function (err, results) {
        if (err) throw err;
        if (!isEmptyObject(results)) gatherResults();
        else if (isOldArticle) insertIntoTable(articleId);
        else {
          if (config.feedSettings.sendOldMessages == true) sendToDiscord(rssIndex, channel, article, false, function (err) { //this can result in great spam once the loads up after a period of downtime
            if (err) console.log(err);
            insertIntoTable(articleId);
          });
          else insertIntoTable(articleId);
        }
      })
    }

    function insertIntoTable(articleId) {
      sqlCmds.insert(con, feedName, articleId, function (err, res){
        if (err) throw err;
        gatherResults();
      })
    }

    function gatherResults() {
      processedItems++;
      if (processedItems == totalItems) {
        callback();
        //console.log(`RSS Info: (${guild.id}, ${guild.name}) => Finished default initialization for: ${feedName}`)
      }
    }

    return startDataProcessing()
  });
}

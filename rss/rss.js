/*
    This is used after initialization for all feeds on first startup.
    The main RSS file that is looping.

    The steps are nearly the same except that this is on a loop, and
    there is no filtering because all unseen data by checkTable is,
    by default, new data because it is on a loop.

    It still has to check the table however because the feedparser
    grabs ALL the data each time, new and old, through the link.
*/
const FeedParser = require('feedparser');
const requestStream = require('./request.js')
const translator = require('./translator/translate.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const sendToDiscord = require('../util/sendToDiscord.js')
const config = require('../config.json')

module.exports = function (con, channel, rssName, isTestMessage, callback) {

  var feedparser = new FeedParser()
  var currentFeed = []

  var guild = require(`../sources/${channel.guild.id}.json`)
  var rssList = guild.sources

  requestStream(rssList[rssName].link, feedparser, function(err) {
    if (err && config.logging.showFeedErrs === true) return callback(err);
    else if (err) return callback();
  })

  feedparser.on('error', function(err) {
    feedparser.removeAllListeners('end')
    if (config.logging.showFeedErrs === true) return callback(err)
    else callback();
  });

  feedparser.on('readable', function() {
    var stream = this
    var item

    while (item = stream.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {
    if (currentFeed.length === 0) {
      if (!isTestMessage) return callback();
      callback(`${rssName}" has no feeds to send for rsstest.`);
      return channel.sendMessage(`Feed "<${rssList[rssName].link}>" has no available feeds to be send for test details.`);
    }

    var processedItems = 0
    var filteredItems = 0

    function getArticleId(article) {
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
      sqlCmds.selectTable(con, rssName, function (err, results) {
        if (err || results.size() === 0) {
          if (err) console.log(`Database error! (${guild.id}, ${guild.name}) => RSS index ${rssName} Feed ${rssName}. Skipping because of error:`, err);
          else if (results.size() === 0) console.log(`RSS Info: (${guild.id}, ${guild.name}) => "${rssName}" appears to have been deleted, skipping...`);
          return callback();
        }
        if (isTestMessage) {
          let randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1));
          checkTable(currentFeed[randFeedIndex]);
        }
        else {
          let feedLength = currentFeed.length - 1;
          for (var x = feedLength; x >= 0; x--) {
            checkTable(currentFeed[x], getArticleId(currentFeed[x]));
            filteredItems++;
          }
        }
      })
    }

    function checkTable(article, articleId) {
      if (isTestMessage) {
        filteredItems++;
        gatherResults();
        sendToDiscord(rssName, channel, article, isTestMessage, function (err) {
          if (err) console.log(err);
        });
      }
      else {
        sqlCmds.select(con, rssName, articleId, function (err, results, fields) {
          if (err) return callback();
          if (results.size() > 0) gatherResults();
          else {
            sendToDiscord(rssName, channel, article, false, function (err) {
              if (err) console.log(err);
            });
            insertIntoTable(articleId);
          }
        })
      }
    }

    function insertIntoTable(articleId) {
      // inserting the feed into the table marks it as "seen"
      sqlCmds.insert(con, rssName, articleId, function (err,res) {
        if (err) return callback();
        gatherResults();
      })
    }

    function gatherResults() {
      processedItems++;
      //console.log(`${rssList[rssName].name} ${filteredItems} ${processedItems}`) // for debugging
      if (processedItems == filteredItems) {
        callback();
      }
    }

    return startDataProcessing()
  });
}

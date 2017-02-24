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

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

module.exports = function (con, channel, rssIndex, isTestMessage, callback) {

  var feedparser = new FeedParser()
  var currentFeed = []

  var guild = require(`../sources/${channel.guild.id}.json`)
  var rssList = guild.sources

  requestStream(rssList[rssIndex].link, feedparser, function(err) {
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
    if (currentFeed.length == 0) {
      if (!isTestMessage) return callback();
      callback();
      console.log(`RSS Info: (${guild.id}, ${guild.name}) => "${rssList[rssIndex].name}" has no feeds to send for rsstest.`);
      return channel.sendMessage(`Feed "${rssList[rssIndex].link}" has no available RSS that can be sent.`);
    }

    let feedName = rssList[rssIndex].name
    var processedItems = 0
    var filteredItems = 0
    //console.log("RSS Info: Starting retrieval for: " + guild.id);

    function getArticleId (article) {
      var equalGuids = (currentFeed.length > 1) ? true : false // default to true for most feeds
      if (equalGuids && currentFeed[0].guid) for (var x in currentFeed) {
        if (x > 0 && currentFeed[x].guid != currentFeed[x - 1].guid) equalGuids = false;
      }

      if ((!article.guid || equalGuids) && article.title) return article.title;
      else if ((!article.guid || equalGuids) && article.pubdate && article.pubdate !== "Invalid Date") return article.pubdate;
      else return article.guid;
    }

    function startDataProcessing() {
      checkTableExists()
    }

    function checkTableExists() {
      sqlCmds.selectTable(con, feedName, function (err, results) {
        if (err || isEmptyObject(results)) {
          if (err) console.log(`Database error! (${guild.id}, ${guild.name}) => RSS index ${rssIndex} Feed ${rssList[rssIndex].link}. Skipping because of error:`, err);
          else if (isEmptyObject(results)) console.log(`RSS Info: (${guild.id}, ${guild.name}) => "${rssList[rssIndex].name}" appears to have been deleted, skipping...`);
          return callback();
        }
        if (isTestMessage) {
          let randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1));
          checkTable(currentFeed[randFeedIndex]);
        }
        else {
          let feedLength = currentFeed.length - 1;
          for (var x = feedLength; x >= 0; x--){
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
        sendToDiscord(rssIndex, channel, article, isTestMessage, function (err) {
          if (err) console.log(err);
        });
      }
      else {
        sqlCmds.select(con, feedName, articleId, function (err, results, fields) {
          if (err) return callback(); // when a table doesn't exist, means it is a removed feed
          if (!isEmptyObject(results)) gatherResults();
          else {
            sendToDiscord(rssIndex, channel, article, false, function (err) {
              if (err) console.log(err);
            });
            insertIntoTable(articleId);
          }
        })
      }
    }


    function insertIntoTable(articleId) { // inserting the feed into the table marks it as "seen"
      sqlCmds.insert(con, feedName, articleId, function (err,res) {
        if (err) return callback();
        gatherResults();
      })
    }

    function gatherResults() {
      processedItems++;
      //console.log(`${rssList[rssIndex].name} ${filteredItems} ${processedItems}`) // for debugging
      if (processedItems == filteredItems) {
        callback();
      }
    }

    return startDataProcessing()
  });
}

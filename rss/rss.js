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
const currentGuilds = require('../util/fetchInterval').currentGuilds

module.exports = function(con, channel, rssName, isTestMessage, callback) {
  const feedparser = new FeedParser()
  const currentFeed = []
  const guildRss = currentGuilds.get(channel.guild.id)
  const rssList = guildRss.sources

  requestStream(rssList[rssName].link, feedparser, function(err) {
    if (err && config.logging.showFeedErrs === true) return callback({type: 'request', content: err, feed: rssList[rssName]});
    else if (err) return callback();
  })

  feedparser.on('error', function(err) {
    feedparser.removeAllListeners('end')
    if (config.logging.showFeedErrs === true) return callback({type: 'feedparser', content: err, feed: rssList[rssName]})
    else callback();
  });

  feedparser.on('readable', function() {
    let item

    while (item = this.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {
    if (currentFeed.length === 0) { // Return callback if there no articles in the feed are found
      if (isTestMessage) return callback({type: 'feedparser', content: 'No existing feeds', feed: rssList[rssName]})
      return callback();
    }

    let processedItems = 0
    let filteredItems = 0

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
        if (err || results.size() === 0) {
          if (err) return callback();
          if (results.size() === 0) console.log(`RSS Info: (${guildRss.id}, ${guildRss.name}) => "${rssName}" appears to have been deleted, skipping...`);
          return callback(); // Callback no error object because 99% of the time it is just a hiccup
        }
        if (isTestMessage) {
          const randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1)); // Grab a random feed from array
          checkTable(currentFeed[randFeedIndex]);
        }
        else {
          const feedLength = currentFeed.length - 1;
          for (var x = feedLength; x >= 0; x--) {
            checkTable(currentFeed[x], getArticleId(currentFeed[x]));
            filteredItems++;
          }
        }
      })
    }

    function checkTable(article, articleId) {
      if (isTestMessage) { // Do not interact with database if just test message
        filteredItems++;
        sendToDiscord(rssName, channel, article, isTestMessage, function(err) {
          if (err) console.log(err);
        });
        return gatherResults();
      }

      let seenArticle = false
      sqlCmds.selectId(con, rssName, articleId, function(err, idMatches, fields) {
        if (err) return callback();
        if (idMatches.length > 0) return decideAction(true);
        sqlCmds.selectTitle(con, rssName, article.title, function(err, titleMatches) { // Double check if title exists if ID was not found in table and is apparently a new article
          if (err) throw err;                                                          // Preventing articles with different GUIDs but same titles from sending is a priority
          if (titleMatches.length > 0) return decideAction(true);
          decideAction(false);
        });
      })

      function decideAction(seenArticle) {
        if (seenArticle) return gatherResults();
        sendToDiscord(rssName, channel, article, false, function(err) {
          if (err) console.log(err);
        });
        insertIntoTable({
          id: articleId,
          title: article.title
        });
      }

    }

    function insertIntoTable(articleInfo) {
      sqlCmds.insert(con, rssName, articleInfo, function(err, res) { // inserting the feed into the table marks it as "seen"
        if (err) return callback();
        gatherResults();
      })
    }

    function gatherResults() {
      processedItems++
      if (processedItems === filteredItems) return callback();
    }

    return startDataProcessing()
  });
}

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
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const logFeedErr = require('../util/logFeedErrs.js')
const debugFeeds = require('../util/debugFeeds').list

module.exports = function(con, link, rssList, uniqueSettings, callback) {
  const feedparser = new FeedParser()
  const currentFeed = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, function(err) {
    if (err) {
      logFeedErr({link: link, content: err}, true);
      callback(true)
    }
  })

  feedparser.on('error', function(err) {
    feedparser.removeAllListeners('end')
    callback(true)
    logFeedErr({link: link, content: err}, true);
  });

  feedparser.on('readable', function() {
    let item

    while (item = this.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {
    if (currentFeed.length === 0) return callback(true);

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
      checkTableExists();

      let newArticles = [];
      let processedItems = 0;
      let filteredItems = 0;


      function checkTableExists() {
        sqlCmds.selectTable(con, rssName, function(err, results) {
          if (err || results.size() === 0) {
            if (err) return logFeedErr({type: 'database', content: err, feed: rssList[rssName]});
            if (results.size() === 0) console.log(`RSS Info: '${rssName}' appears to have been deleted, skipping...`);
            return callback(true); // Callback no error object because 99% of the time it is just a hiccup
          }

          if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Table has been selected.`)

          const feedLength = currentFeed.length - 1;
          for (var x = feedLength; x >= 0; x--) {
            // if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Checking table for (ID: ${getArticleId(currentFeed[x])}, TITLE: ${currentFeed[x].title})`);
            checkTable(currentFeed[x], getArticleId(currentFeed[x]));
            filteredItems++;
          }
        })
      }

      function checkTable(article, articleId) {
        let seenArticle = false
        sqlCmds.selectId(con, rssName, articleId, function(err, idMatches, fields) {
          if (err) return logFeedErr({type: 'database', content: err, feed: rssList[rssName]});
          if (idMatches.length > 0) {
            // if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Matched ID in table for (ID: ${articleId}, TITLE: ${article.title}).`);
            return decideAction(true);
          }
          sqlCmds.selectTitle(con, rssName, article.title, function(err, titleMatches) { // Double check if title exists if ID was not found in table and is apparently a new article
            if (err) throw err;                                                          // Preventing articles with different GUIDs but same titles from sending is a priority
            if (titleMatches.length > 0) {
              // if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Matched TITLE in table for (ID: ${articleId}, TITLE: ${article.title}).`);
              return decideAction(true);
            }
            decideAction(false)
          })
        })

        function decideAction(seenArticle) {
          if (seenArticle) return gatherResults();
          if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Never seen article (ID: ${articleId}, TITLE: ${article.title}), sending now`);
          article.rssName = rssName
          article.discordChannelId = channelId
          callback(false, article, rssList[rssName].guildId)
          insertIntoTable({
            id: articleId,
            title: article.title
          })
        }

      }

      function insertIntoTable(articleInfo) {
        sqlCmds.insert(con, rssName, articleInfo, function(err, res) { // inserting the feed into the table marks it as "seen"
          if (err) return logFeedErr({type: 'database', content: err, feed: rssList[rssName]});
          if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Article (ID: ${articleInfo.id}, TITLE: ${articleInfo.title}) should have been sent, and now added into table`);
          gatherResults();
        })
      }

      function gatherResults() {
        processedItems++
        if (processedItems === filteredItems) return finishSource(); // Handling on a source ends when processedItems = filteredItems
      }
    }

    for (var rssName in rssList) processSource(rssName); // Per source in one link

    function finishSource() {
      sourcesCompleted++
      if (sourcesCompleted === rssList.size()) return callback(true)
    }

  })


}

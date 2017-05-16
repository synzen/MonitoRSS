/*
  Each batch of link maps (of length batchSize) in a batchList will have a forked rssProcessor
*/
const FeedParser = require('feedparser');
const requestStream = require('./request.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const logFeedErr = require('../util/logFeedErrs.js')
const moment = require('moment-timezone')
const config = require('../config.json')
if (require('../config.json').logging.logDates == true) require('../util/logDates.js')()

let con

Object.defineProperty(Object.prototype, 'size', {
    value: function() {
      let c = 0
      for (var x in this) if (this.hasOwnProperty(x)) c++;
      return c
    },
    enumerable: false,
    writable: true
});

function rss(link, rssList, uniqueSettings, debugFeeds) {
  const feedparser = new FeedParser()
  const currentFeed = []

  const cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, function(err) {
    if (err) {
      logFeedErr({link: link, content: err}, true);
      process.send({status: 'failed', link: link, rssList: rssList});
    }
  })

  feedparser.on('error', function(err) {
    logFeedErr({link: link, content: err}, true);
    process.send({status: 'failed', link: link, rssList: rssList})
    feedparser.removeAllListeners('end')
  });

  feedparser.on('readable', function() {
    let item

    while (item = this.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {

    if (currentFeed.length === 0) return process.send({status: 'success', link: link});

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

      let newArticles = [];
      let processedItems = 0;
      let filteredItems = 0;


      function checkTableExists() {
        sqlCmds.selectTable(con, rssName, function(err, results) {
          if (err || results.length === 0) {
            if (err) return logFeedErr({type: 'database', link: link, content: err, feed: rssList[rssName]});
            if (results.length === 0) console.log(`RSS Info: '${rssName}' appears to have been deleted, skipping...`);
            return process.send({status: 'success', link: link}); // Callback no error object because 99% of the time it is just a hiccup
          }

          if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Table has been selected. Size of currentFeed: ${currentFeed.length}`)

          const feedLength = currentFeed.length - 1
          const cycleMaxAge = config.feedSettings.cycleMaxAge && !isNaN(parseInt(config.feedSettings.cycleMaxAge, 10)) ? parseInt(config.feedSettings.cycleMaxAge, 10) : 1

          for (var x = feedLength; x >= 0; x--) {
            if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Checking table for (ID: ${getArticleId(currentFeed[x])}, TITLE: ${currentFeed[x].title})`);

            if (currentFeed[x].pubdate && currentFeed[x].pubdate !== 'Invalid Date' && currentFeed[x].pubdate > moment().subtract(cycleMaxAge, 'days')) checkTable(currentFeed[x], getArticleId(currentFeed[x]));
            else checkTable(currentFeed[x], getArticleId(currentFeed[x]), true);

            filteredItems++;
          }
        })
      }

      function checkTable(article, articleId, isOldArticle) {
        sqlCmds.selectId(con, rssName, articleId, function(err, idMatches, fields) {
          if (err) return logFeedErr({type: 'database', link: link, content: err, feed: rssList[rssName]});

          if (idMatches.length > 0) {
            if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Matched ID in table for (ID: ${articleId}, TITLE: ${article.title}).`);
            return seenArticle(true);
          }

          if (config.feedSettings.checkTitles != true && rssList[rssName].checkTitles != true || config.feedSettings.checkTitles == false && rssList[rssName].checkTitles == true) return seenArticle(false);

          sqlCmds.selectTitle(con, rssName, article.title, function(err, titleMatches) {
            if (err) throw err;

            if (titleMatches.length > 0) {
              if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Matched TITLE in table for (ID: ${articleId}, TITLE: ${article.title}).`);
              return seenArticle(true);
            }

            seenArticle(false)
          })

        })

        function seenArticle(seen) {
          if (seen) return gatherResults();

          if (debugFeeds.includes(rssName)) {
            if (!isOldArticle) console.log(`DEBUG ${rssName}: Never seen article (ID: ${articleId}, TITLE: ${article.title}), sending now`);
            else console.log(`DEBUG ${rssName}: Never seen article, but declared old - not sending (ID: ${articleId}, TITLE: ${article.title})`);
          }

          article.rssName = rssName;
          article.discordChannelId = channelId;
          if (!isOldArticle) process.send({status: 'article', article: article});

          insertIntoTable({
            id: articleId,
            title: article.title
          })
        }
      }

      function insertIntoTable(articleInfo) {
        sqlCmds.insert(con, rssName, articleInfo, function(err, res) { // inserting the feed into the table marks it as "seen"
          if (err) return logFeedErr({type: 'database', link: link, content: err, feed: rssList[rssName]});
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
      if (sourcesCompleted === rssList.size()) return process.send({status: 'success', link: link});
    }

  })

}


process.on('message', function(m) {

  if (!con) con = sqlConnect(function() {
    rss(m.link, m.rssList, m.uniqueSettings, m.debugFeeds)
  })
  else rss(m.link, m.rssList, m.uniqueSettings, m.debugFeeds);

})

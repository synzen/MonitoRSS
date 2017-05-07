process.on('uncaughtException', function(err) {
  console.info(err)
  process.send({type: 'kill', contents: err})
  process.exit()
})

const config = require('../config.json')
const moment = require('moment-timezone')
const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
if (config.logging.logDates) require('../util/logDates.js')()

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

function init(link, rssList, uniqueSettings) {
  const feedparser = new FeedParser()
  const currentFeed = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, function(err) {
    if (err) {
      console.log(`INIT Error: Skipping ${link}. (${err})`);
      return process.send('linkComplete')
    }
  })

  feedparser.on('error', function(err) {
    feedparser.removeAllListeners('end')
    console.log(`INIT Error: Skipping ${link}. (${err})`)
    return process.send('linkComplete')
  });

  feedparser.on('readable', function() {
    let item;

    while (item = this.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {
    // Return if no articles in feed found
    if (currentFeed.length === 0) return process.send('linkComplete');

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
            process.send({article: article})
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
      if (sourcesCompleted === rssList.size()) return process.send('linkComplete');
    }
  })
}

process.on('message', function(m) {
  if (!con) con = sqlConnect(function(err) {
    if (err) throw new Error(`Could not connect to SQL database for initialization. (${err})`)
    init(m.link, m.rssList, m.uniqueSettings, m.debugFeeds)
  })
  else init(m.link, m.rssList, m.uniqueSettings, m.debugFeeds);
})

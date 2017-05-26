const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const sqlCmds = require('./sql/commands.js')
const logFeedErr = require('../util/logFeedErrs.js')
const debugFeeds = require('../util/debugFeeds').list
const moment = require('moment-timezone')
const config = require('../config.json')

module.exports = function (con, link, rssList, uniqueSettings, callback) {
  const feedparser = new FeedParser()
  const currentFeed = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, function (err) {
    if (err) {
      logFeedErr({link: link, content: err}, true)
      callback({status: 'failed', link: link, rssList: rssList})
    }
  })

  feedparser.on('error', function (err) {
    feedparser.removeAllListeners('end')
    callback({status: 'failed', link: link, rssList: rssList})
    logFeedErr({link: link, content: err}, true)
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) {
      currentFeed.push(item)
    }
  })

  feedparser.on('end', function () {
    if (currentFeed.length === 0) return callback({status: 'success', link: link})

    let sourcesCompleted = 0

    function getArticleId (article) {
      let equalGuids = (currentFeed.length > 1) // default to true for most feeds
      if (equalGuids && currentFeed[0].guid) {
        for (var x in currentFeed) {
          if (parseInt(x, 10) > 0 && currentFeed[x].guid !== currentFeed[x - 1].guid) equalGuids = false
        }
      }

      if ((!article.guid || equalGuids) && article.title) return article.title
      if ((!article.guid || equalGuids) && !article.title && article.pubdate && article.pubdate.toString() !== 'Invalid Date') return article.pubdate
      return article.guid
    }

    function processSource (rssName) {
      const channelId = rssList[rssName].channel

      let processedArticles = 0
      let totalArticles = 0

      checkTableExists()

      function checkTableExists () {
        sqlCmds.selectTable(con, rssName, function (err, results) {
          if (err) {
            console.log(`Database Error: Unable to select table ${rssName}, skipping source (${err})`)
            return callback({status: 'success', link: link})
          } else if (results.length === 0) { // When no error, but the table does not exist and was not a feed that was deleted during this cycle
            console.log(`RSS Info: '${rssName}' appears to have been deleted, skipping...`)
            return callback({status: 'success', link: link})
          }

          if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Table has been selected. Size of currentFeed: ${currentFeed.length}`)

          const feedLength = currentFeed.length - 1
          const cycleMaxAge = config.feedSettings.cycleMaxAge && !isNaN(parseInt(config.feedSettings.cycleMaxAge, 10)) ? parseInt(config.feedSettings.cycleMaxAge, 10) : 1

          for (var x = feedLength; x >= 0; x--) {
            if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Checking table for (ID: ${getArticleId(currentFeed[x])}, TITLE: ${currentFeed[x].title})`)

            if (currentFeed[x].pubdate && currentFeed[x].pubdate.toString() !== 'Invalid Date' && currentFeed[x].pubdate > moment().subtract(cycleMaxAge, 'days')) checkTable(currentFeed[x], getArticleId(currentFeed[x]))
            else checkTable(currentFeed[x], getArticleId(currentFeed[x]), true)

            totalArticles++
          }
        })
      }

      function checkTable (article, articleId, isOldArticle) {
        sqlCmds.selectId(con, rssName, articleId, function (err, idMatches, fields) {
          if (err) {
            console.log(`Database Error: Unable to select ID ${articleId} in table ${rssName} (${err})`)
            return incrementProgress()
          }

          if (idMatches.length > 0) {
            if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Matched ID in table for (ID: ${articleId}, TITLE: ${article.title}).`)
            return seenArticle(true)
          }

          if ((config.feedSettings.checkTitles !== true && rssList[rssName].checkTitles !== true) || (config.feedSettings.checkTitles === false && rssList[rssName].checkTitles !== true)) return seenArticle(false)

          sqlCmds.selectTitle(con, rssName, article.title, function (err, titleMatches) {
            if (err) {
              console.log(`Database Error: Unable to select title ${articleId} in table ${rssName} (${err})`)
              return incrementProgress()
            }

            if (titleMatches.length > 0) {
              if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Matched TITLE in table for (ID: ${articleId}, TITLE: ${article.title}).`)
              return seenArticle(false, true)
            }

            seenArticle(false)
          })
        })

        function seenArticle (seen, doNotSend) {
          if (seen) return incrementProgress()
          if (debugFeeds.includes(rssName)) {
            if (!isOldArticle) console.log(`DEBUG ${rssName}: Never seen article (ID: ${articleId}, TITLE: ${article.title}), sending now`)
            else console.log(`DEBUG ${rssName}: Never seen article, but declared old - not sending (ID: ${articleId}, TITLE: ${article.title})`)
          }

          article.rssName = rssName
          article.discordChannelId = channelId
          if (!isOldArticle && !doNotSend) callback({status: 'article', article: article})

          insertIntoTable({
            id: articleId,
            title: article.title
          })
        }
      }

      function insertIntoTable (articleInfo) {
        sqlCmds.insert(con, rssName, articleInfo, function (err, res) { // inserting the feed into the table marks it as "seen"
          if (err) {
            console.log(`Database Error: Unable to insert ${articleInfo.id} in table ${rssName} (${err})`)
            return incrementProgress()
          }
          if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Article (ID: ${articleInfo.id}, TITLE: ${articleInfo.title}) should have been sent, and now added into table`)
          incrementProgress()
        })
      }

      function incrementProgress () {
        processedArticles++
        if (processedArticles === totalArticles) return finishSource()
      }
    }

    for (var rssName in rssList) processSource(rssName) // Per source in one link

    function finishSource () {
      sourcesCompleted++
      if (sourcesCompleted === rssList.size()) return callback({status: 'success', link: link})
    }
  })
}

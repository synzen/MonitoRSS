const config = require('../config.json')
const moment = require('moment-timezone')
const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const sqlCmds = require('./sql/commands.js')

module.exports = function (con, link, rssList, uniqueSettings, callback) {
  const feedparser = new FeedParser()
  const articleList = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, function (err) {
    if (err) {
      return callback({status: 'failed', link: link, rssList: rssList})
    }
  })

  feedparser.on('error', function (err) {
    feedparser.removeAllListeners('end')
    return callback({status: 'failed', link: link, rssList: rssList})
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) {
      articleList.push(item)
    }
  })

  feedparser.on('end', function () {
    // Return if no articles in feed found
    if (articleList.length === 0) return callback({status: 'success', link: link})

    const totalArticles = articleList.length
    let sourcesCompleted = 0

    function getArticleId (article) {
      let equalGuids = (articleList.length > 1) // default to true for most feeds
      if (equalGuids && articleList[0].guid) {
        for (var x in articleList) {
          if (parseInt(x, 10) > 0 && articleList[x].guid !== articleList[x - 1].guid) equalGuids = false
        }
      }

      if ((!article.guid || equalGuids) && article.title) return article.title
      if ((!article.guid || equalGuids) && !article.title && article.pubdate && article.pubdate.toString() !== 'Invalid Date') return article.pubdate
      return article.guid
    }

    function processSource (rssName) {
      const channelId = rssList[rssName].channel
      checkTableExists()

      let processedArticles = 0

      function checkTableExists () {
        sqlCmds.selectTable(con, rssName, function (err, results) {
          if (err) throw err
          if (results.size() === 0) {
            console.log(`INIT Info: Table does not exist for ${rssName}, creating now and initializing all`)
            createTable()
          } else {
            if (config.feedManagement.cleanDatabase === true) {
              let idArray = []
              for (var p in articleList) idArray.push(getArticleId(articleList[p]))
              sqlCmds.cleanTable(con, rssName, idArray)
            }

            const feedLength = articleList.length - 1
            const defaultMaxAge = config.feedSettings.defaultMaxAge && !isNaN(parseInt(config.feedSettings.defaultMaxAge, 10)) ? parseInt(config.feedSettings.defaultMaxAge, 10) : 1

            for (var x = feedLength; x >= 0; x--) { // Get feeds starting from oldest, ending with newest.
              const cutoffDay = (rssList[rssName].maxAge) ? moment().subtract(rssList[rssName].maxAge, 'days') : moment().subtract(defaultMaxAge, 'days')

              if (articleList[x].pubdate >= cutoffDay) checkTable(articleList[x], getArticleId(articleList[x]))
              else if (articleList[x].pubdate < cutoffDay || articleList[x].pubdate.toString() === 'Invalid Date') {
                checkTable(articleList[x], getArticleId(articleList[x]), true)
              }
            }
          }
        })
      }

      function createTable () {
        sqlCmds.createTable(con, rssName, function (err, results) {
          if (err) throw err
          for (var x in articleList) {
            insertIntoTable({
              id: getArticleId(articleList[x]),
              title: articleList[x].title
            })
          }
        })
      }

      function checkTable (article, articleId, isOldArticle) {
        sqlCmds.selectId(con, rssName, articleId, function (err, IdMatches) {
          if (err) throw err
          if (IdMatches.length > 0) return seenArticle(true)

          if ((config.feedSettings.checkTitles !== true && rssList[rssName].checkTitles !== true) || (config.feedSettings.checkTitles === false && rssList[rssName].checkTitles !== true)) return seenArticle(false)

          sqlCmds.selectTitle(con, rssName, article.title, function (err, titleMatches) {
            if (err) throw err
            if (titleMatches.length > 0) return seenArticle(false, true)
            seenArticle(false)
          })
        })

        function seenArticle (seen, doNotSend) {
          if (seen) return incrementProgress() // Stops here if it already exists in table, AKA "seen"

          if (config.feedSettings.sendOldMessages === true && !isOldArticle && !doNotSend) {
            article.rssName = rssName
            article.discordChannelId = channelId
            callback({status: 'article', article: article})
          }

          insertIntoTable({
            id: articleId,
            title: article.title
          })
        }
      }

      function insertIntoTable (articleInfo) {
        sqlCmds.insert(con, rssName, articleInfo, function (err, res) {
          if (err) throw err
          incrementProgress()
        })
      }

      function incrementProgress () {
        processedArticles++
        if (processedArticles === totalArticles) finishSource()
      }
    }

    for (var rssName in rssList) processSource(rssName)

    function finishSource () {
      sourcesCompleted++
      if (sourcesCompleted === rssList.size()) return callback({status: 'success', link: link})
    }
  })
}

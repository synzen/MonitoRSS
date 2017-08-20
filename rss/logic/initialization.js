const config = require('../../config.json')
const sqlCmds = require('../sql/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs

function getArticleId (articleList, article) {
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

module.exports = function (con, rssList, articleList, link, callback) {
  const totalArticles = articleList.length
  let sourcesCompleted = 0

  function processSource (rssName) {
    const channelId = rssList[rssName].channel
    checkTableExists()

    let processedArticles = 0

    function checkTableExists () {
      sqlCmds.selectTable(con, rssName, function (err, results) {
        if (err) return callback(err)
        if (results.size() === 0) {
          console.log(`INIT Info: Table does not exist for ${rssName}, creating now and initializing all`)
          createTable()
        } else {
          if (config.feedManagement.cleanDatabase === true) {
            let idArray = []
            for (var p in articleList) idArray.push(getArticleId(articleList, articleList[p]))
            sqlCmds.cleanTable(con, rssName, idArray)
          }

          const feedLength = articleList.length - 1
          const defaultMaxAge = config.feedSettings.defaultMaxAge && !isNaN(parseInt(config.feedSettings.defaultMaxAge, 10)) ? parseInt(config.feedSettings.defaultMaxAge, 10) : 1

          for (var x = feedLength; x >= 0; x--) { // Get feeds starting from oldest, ending with newest.
            const cutoffDay = (rssList[rssName].maxAge) ? moment().subtract(rssList[rssName].maxAge, 'days') : moment().subtract(defaultMaxAge, 'days')

            if (articleList[x].pubdate >= cutoffDay) checkTable(articleList[x], getArticleId(articleList, articleList[x]))
            else if (articleList[x].pubdate < cutoffDay) {
              checkTable(articleList[x], getArticleId(articleList, articleList[x]), true)
            } else if (articleList[x].pubdate.toString() === 'Invalid Date') {
              let checkDate = false
              const globalSetting = config.feedSettings.checkDates != null ? config.feedSettings.checkDates : defaultConfigs.feedSettings.checkDates.default
              checkDate = globalSetting
              const specificSetting = rssList[rssName].checkDates
              checkDate = typeof specificSetting !== 'boolean' ? checkDate : specificSetting

              if (checkDate) checkTable(articleList[x], getArticleId(articleList, articleList[x]), true) // Mark as old if date checking is enabled
              else checkTable(articleList[x], getArticleId(articleList, articleList[x])) // Otherwise mark it new
            } else checkTable(articleList[x], getArticleId(articleList, articleList[x]), true)
          }
        }
      })
    }

    function createTable () {
      sqlCmds.createTable(con, rssName, function (err, results) {
        if (err) return callback(err)
        for (var x in articleList) {
          insertIntoTable({
            id: getArticleId(articleList, articleList[x]),
            title: articleList[x].title
          })
        }
      })
    }

    function checkTable (article, articleId, isOldArticle) {
      sqlCmds.selectId(con, rssName, articleId, function (err, IdMatches) {
        if (err) return callback(err)
        if (IdMatches.length > 0) return seenArticle(true)

        let check = false
        const globalSetting = config.feedSettings.checkTitles != null ? config.feedSettings.checkTitles : defaultConfigs.feedSettings.checkTitles.default
        check = globalSetting
        const specificSetting = rssList[rssName].checkTitles
        check = typeof specificSetting !== 'boolean' ? check : specificSetting
        if (!check) return seenArticle(false)

        sqlCmds.selectTitle(con, rssName, article.title, function (err, titleMatches) {
          if (err) return callback(err)
          if (titleMatches.length > 0) return seenArticle(false, true) // Still mark as unseen because its articleId was different, and thus needs to be inserted to table
          seenArticle(false)
        })
      })

      function seenArticle (seen, doNotSend) {
        if (seen) return incrementProgress() // Stops here if it already exists in table, AKA "seen"

        if (config.feedSettings.sendOldMessages === true && !isOldArticle && !doNotSend) {
          article.rssName = rssName
          article.discordChannelId = channelId
          callback(null, {status: 'article', article: article})
          // process.send({status: 'article', article: article})
        }

        insertIntoTable({
          id: articleId,
          title: article.title
        })
      }
    }

    function insertIntoTable (articleInfo) {
      sqlCmds.insert(con, rssName, articleInfo, function (err, res) {
        if (err) return callback(err)
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
    // if (sourcesCompleted === rssList.size()) return process.send({status: 'success', link: link})
    if (sourcesCompleted === rssList.size()) return callback(null, {status: 'success'})
  }
}

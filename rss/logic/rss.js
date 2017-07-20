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

module.exports = function (con, rssList, articleList, debugFeeds, link, callback) {
  let sourcesCompleted = 0

  function processSource (rssName) {
    const channelId = rssList[rssName].channel

    let processedArticles = 0
    let totalArticles = 0

    checkTableExists()

    function checkTableExists () {
      sqlCmds.selectTable(con, rssName, function (err, results) {
        if (err) {
          return callback(new Error(`Unable to select table ${rssName}, skipping source.\n`, err), {status: 'success', link: link})
        } else if (results.length === 0) { // When no error, but the table does not exist and was not a feed that was deleted during this cycle
          return callback(new Error(`Unable to select table ${rssName}, may be a deleted source. Skipping.`), {status: 'success', link: link})
        }

        if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Table has been selected. Size of articleList: ${articleList.length}`)

        const feedLength = articleList.length - 1
        const cycleMaxAge = config.feedSettings.cycleMaxAge && !isNaN(parseInt(config.feedSettings.cycleMaxAge, 10)) ? parseInt(config.feedSettings.cycleMaxAge, 10) : 1

        for (var x = feedLength; x >= 0; x--) {
          // if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Checking table for (ID: ${getArticleId(articleList, articleList[x])}, TITLE: ${articleList[x].title})`)

          if (articleList[x].pubdate && articleList[x].pubdate > moment().subtract(cycleMaxAge, 'days')) checkTable(articleList[x], getArticleId(articleList, articleList[x]))
          else { // Invalid dates are pubdate.toString() === 'Invalid Date'
            let checkDate = false
            const globalSetting = config.feedSettings.checkDates != null ? config.feedSettings.checkDates : defaultConfigs.feedSettings.checkDates.default
            checkDate = globalSetting
            const specificSetting = rssList[rssName].checkDates
            checkDate = typeof specificSetting !== 'boolean' ? checkDate : specificSetting

            if (checkDate) checkTable(articleList[x], getArticleId(articleList, articleList[x]), true)  // Mark as old if date checking is enabled
            else checkTable(articleList[x], getArticleId(articleList, articleList[x])) // Otherwise mark as new
          }

          totalArticles++
        }
      })
    }

    function checkTable (article, articleId, isOldArticle) {
      sqlCmds.selectId(con, rssName, articleId, function (err, idMatches, fields) {
        if (err) {
          callback(new Error(`Database Error: Unable to select ID ${articleId} in table ${rssName} (${err})`))
          return incrementProgress()
        }
        if (idMatches.length > 0) {
          // if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Matched ID in table for (ID: ${articleId}, TITLE: ${article.title}).`)
          return seenArticle(true)
        }

        let check = false
        const globalSetting = config.feedSettings.checkTitles != null ? config.feedSettings.checkTitles : defaultConfigs.feedSettings.checkTitles.default
        check = globalSetting
        const specificSetting = rssList[rssName].checkTitles
        check = typeof specificSetting !== 'boolean' ? check : specificSetting
        if (!check) return seenArticle(false)

        sqlCmds.selectTitle(con, rssName, article.title, function (err, titleMatches) {
          if (err) {
            callback(new Error(`Database Error: Unable to select title ${articleId} in table ${rssName} (${err})`))
            return incrementProgress()
          }

          if (titleMatches.length > 0) {
            if (debugFeeds.includes(rssName)) console.log(`DEBUG ${rssName}: Matched TITLE in table for (ID: ${articleId}, TITLE: ${article.title}).`)
            return seenArticle(false, true) // Still mark as unseen because its articleId was different, and thus needs to be inserted to table
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
        if (!isOldArticle && !doNotSend) callback(null, {status: 'article', article: article})

        insertIntoTable({
          id: articleId,
          title: article.title
        })
      }
    }

    function insertIntoTable (articleInfo) {
      sqlCmds.insert(con, rssName, articleInfo, function (err, res) { // inserting the feed into the table marks it as "seen"
        if (err) {
          callback(new Error(`Database Error: Unable to insert ${articleInfo.id} in table ${rssName} (${err})`))
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
    if (sourcesCompleted === rssList.size()) return callback(null, {status: 'success', link: link})
  }
}

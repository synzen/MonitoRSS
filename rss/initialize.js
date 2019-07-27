const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const dbOpsGuilds = require('../util/db/guilds.js')
const dbOpsSchedules = require('../util/db/schedules.js')
const config = require('../config.js')
const path = require('path')
const fs = require('fs')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).version
const dbCmds = require('./db/commands.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const ArticleIDResolver = require('../structs/ArticleIDResolver.js')

exports.initializeFeed = async (articleList, link, rssName, idResolver, assignedSchedule) => {
  if (articleList.length === 0) return

  // Initialize the feed collection if necessary, but only if a database is used. This file has no access to the feed collections if config.database.uri is a databaseless folder path
  if (!config.database.uri.startsWith('mongo')) return
  try {
    // The schedule must be assigned to the feed first in order to get the correct feed collection ID for the feed model (through storage.schedulesAssigned, third argument of models.Feed)
    const Feed = storage.models.Feed(link, storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : null, assignedSchedule)
    const docs = await dbCmds.findAll(Feed)
    if (docs.length > 0) return // The collection already exists from a previous addition, no need to initialize
    const useIDType = idResolver.getIDType()
    articleList.forEach(article => {
      article._id = ArticleIDResolver.getIDTypeValue(article, useIDType)
    })
    await dbCmds.bulkInsert(Feed, articleList)
  } catch (err) {
    log.general.warning(`Unable to initialize ${link}`, err, true)
  }
}

exports.addNewFeed = async (settings, customTitle) => {
  const { channel } = settings
  let link = settings.link
  const feedparser = new FeedParser()
  const idResolver = new ArticleIDResolver()
  const articleList = []
  let errored = false // Sometimes feedparser emits error twice

  let guildRss = await dbOpsGuilds.get(channel.guild.id)
  if (guildRss) {
    const currentRSSList = guildRss.sources
    if (currentRSSList) {
      for (var n in currentRSSList) {
        const source = currentRSSList[n]
        if (source.link === link && source.channel === channel.id) {
          const err = new Error('Already exists for this channel.')
          err.code = 40003
          err.type = 'resolved'
          throw err
        }
      }
    }
  }

  try {
    const stream = await requestStream(link)
    stream.pipe(feedparser)
  } catch (err) {
    if (errored === false) {
      errored = true
      err.message = '(Connection failed) ' + err.message
      err.code = 50042
      throw err
    }
  }

  return new Promise((resolve, reject) => {
    feedparser.on('error', err => {
      feedparser.removeAllListeners('end')
      if (err && errored === false) {
        errored = true
        if (err.message === 'Not a feed') {
          err.code = 40002
          err.message = 'That is a not a valid feed. Note that you cannot add just any link. You may check if it is a valid feed by using online RSS feed validators'
        }
        return reject(err)
      }
    })

    feedparser.on('readable', function () {
      let item
      do {
        item = this.read()
        if (item) {
          idResolver.recordArticle(item)
          articleList.push(item)
        }
      } while (item)
    })

    feedparser.on('end', async () => {
      if (errored) return
      try {
        const shardId = storage.bot && storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : null
        let rssName = `${storage.collectionID(link, shardId)}-${Math.floor((Math.random() * 99999) + 1)}`.replace(/[^a-zA-Z0-9-_]/g, '')
        let assignedSchedule = await dbOpsSchedules.assignedSchedules.get(rssName)
        while (assignedSchedule) {
          rssName += Math.floor((Math.random() * 9) + 1)
          assignedSchedule = await dbOpsSchedules.assignedSchedules.get(rssName)
        }
        let metaTitle = customTitle || ((articleList[0] && articleList[0].meta.title) ? articleList[0].meta.title : 'Untitled')

        if (articleList[0] && articleList[0].guid && articleList[0].guid.startsWith('yt:video')) metaTitle = `Youtube - ${articleList[0].meta.title}`
        else if (articleList[0] && articleList[0].meta.link && articleList[0].meta.link.includes('reddit')) metaTitle = `Reddit - ${articleList[0].meta.title}`

        if (metaTitle.length > 200) metaTitle = metaTitle.slice(0, 200) + '...'

        const allArticlesHaveDates = articleList.reduce((acc, article) => acc && (!!article.pubdate), true)

        if (guildRss) {
          if (!guildRss.sources) guildRss.sources = {}

          var rssList = guildRss.sources
          rssList[rssName] = {
            title: metaTitle,
            link: link,
            channel: channel.id,
            addedOn: new Date()
          }
        } else {
          guildRss = {
            version: packageVersion,
            name: channel.guild.name,
            id: channel.guild.id,
            sources: {}
          }
          guildRss.sources[rssName] = {
            title: metaTitle,
            link: link,
            channel: channel.id,
            addedOn: new Date()
          }
        }
        if (!allArticlesHaveDates) guildRss.sources[rssName].checkDates = false
        if (storage.scheduleManager) {
          assignedSchedule = await storage.scheduleManager.assignSchedule(rssName, guildRss)
        }

        if (storage.bot) exports.initializeFeed(articleList, link, rssName, idResolver, assignedSchedule).catch(err => log.general.warning(`Unable to initialize feed collection for link ${link} with rssName ${rssName}`, channel.guild, err, true))
        await dbOpsGuilds.update(guildRss) // Must be added to database first for the FeedSchedules to see the feed
        resolve([ link, metaTitle, rssName ])
      } catch (err) {
        reject(err)
      }
    })
  })
}

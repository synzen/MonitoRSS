const fs = require('fs')
const path = require('path')
const config = require('../config.js')
const log = require('../util/logger.js')
const dbCmds = require('./db/commands.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const dbOpsSchedules = require('../util/db/schedules.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const storage = require('../util/storage.js')
const Article = require('../models/Article.js')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).version

exports.initializeFeed = async (articleList, link, assignedSchedule) => {
  if (articleList.length === 0) return

  // Initialize the feed collection if necessary, but only if a database is used. This file has no access to the feed collections if config.database.uri is a databaseless folder path
  if (!config.database.uri.startsWith('mongo')) return
  try {
    // The schedule must be assigned to the feed first in order to get the correct feed collection ID for the feed model (through storage.schedulesAssigned, third argument of models.Feed)
    const Feed = Article.model(link, storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : null, assignedSchedule)
    const docs = await dbCmds.findAll(Feed)
    if (docs.length > 0) return // The collection already exists from a previous addition, no need to initialize

    await dbCmds.bulkInsert(Feed, articleList)
  } catch (err) {
    log.general.warning(`Unable to initialize ${link}`, err, true)
  }
}

exports.addNewFeed = async (settings, customTitle) => {
  const { channel } = settings
  let link = settings.link
  const { articleList } = await FeedFetcher.fetchFeed(link)

  let guildRss = await dbOpsGuilds.get(channel.guild.id)
  if (guildRss) {
    const currentRSSList = guildRss.sources
    if (currentRSSList) {
      for (const n in currentRSSList) {
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

  const shardId = storage.bot && storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : null
  let rssName = `${Article.getCollectionID(link, shardId)}-${Math.floor((Math.random() * 99999) + 1)}`.replace(/[^a-zA-Z0-9-_]/g, '')
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

  if (storage.bot) exports.initializeFeed(articleList, link, assignedSchedule).catch(err => log.general.warning(`Unable to initialize feed collection for link ${link} with rssName ${rssName}`, channel.guild, err, true))
  await dbOpsGuilds.update(guildRss) // Must be added to database first for the FeedSchedules to see the feed
  return [ link, metaTitle, rssName ]
}

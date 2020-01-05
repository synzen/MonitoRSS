const config = require('../config.js')
const log = require('../util/logger.js')
const dbCmds = require('./db/commands.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const Article = require('../models/Article.js')
const Feed = require('../structs/db/Feed.js')

exports.initializeFeed = async (articleList, link, assignedSchedule, shardId) => {
  if (articleList.length === 0) return

  // Initialize the feed collection if necessary, but only if a database is used. This file has no access to the feed collections if config.database.uri is a databaseless folder path
  if (!config.database.uri.startsWith('mongo')) return
  try {
    // The schedule must be assigned to the feed first in order to get the correct feed collection ID for the feed model (through storage.schedulesAssigned, third argument of models.Feed)
    const Feed = Article.model(link, shardId, assignedSchedule)
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

  const feeds = await Feed.getManyBy('guild', channel.guild.id)
  for (const feed of feeds) {
    if (feed.url === link && feed.channel === channel.id) {
      const err = new Error('Already exists for this channel.')
      err.code = 40003
      err.type = 'resolved'
      throw err
    }
  }

  const shardId = channel.client.shard && channel.client.shard.count > 0 ? channel.client.shard.id : -1
  // const feedId = new mongoose.Types.ObjectId()
  let metaTitle = customTitle || ((articleList[0] && articleList[0].meta.title) ? articleList[0].meta.title : 'Untitled')

  if (articleList[0] && articleList[0].guid && articleList[0].guid.startsWith('yt:video')) {
    metaTitle = `Youtube - ${articleList[0].meta.title}`
  } else if (articleList[0] && articleList[0].meta.link && articleList[0].meta.link.includes('reddit')) {
    metaTitle = `Reddit - ${articleList[0].meta.title}`
  }
  if (metaTitle.length > 200) {
    metaTitle = metaTitle.slice(0, 200) + '...'
  }

  const allArticlesHaveDates = articleList.reduce((acc, article) => acc && (!!article.pubdate), true)

  const newFeedData = {
    guild: channel.guild.id,
    url: link,
    title: metaTitle,
    channel: channel.id
  }

  if (!allArticlesHaveDates) {
    newFeedData.checkDates = false
  }
  const newFeed = new Feed(newFeedData)
  await newFeed.save()
  const schedule = await newFeed.determineSchedule()

  exports.initializeFeed(articleList, link, schedule, shardId)
    .catch(err => log.general.warning(`Unable to initialize feed collection for link ${link} with rssName ${newFeed.id}`, channel.guild, err, true))
  return [ link, metaTitle, newFeed.id, schedule ]
}

const express = require('express')
const config = require('../../../config.js')
const Article = require('../../../structs/Article.js')
const feeds = express.Router({ mergeParams: true })
const statusCodes = require('../../constants/codes.js')
const dbOpsGuilds = require('../../../util/db/guilds.js')
const dbOpsSchedules = require('../../../util/db/schedules.js')
const dbOpsFailedLinks = require('../../../util/db/failedLinks.js')
const initialize = require('../../../rss/initialize.js')
const serverLimit = require('../../../util/serverLimit.js')
const RedisGuild = require('../../../structs/db/Redis/Guild.js')
const RedisChannel = require('../../../structs/db/Redis/Channel.js')
const storage = require('../../../util/storage.js')
const FeedFetcher = require('../../../util/FeedFetcher.js')
const RequestError = require('../../../structs/errors/RequestError.js')
const FeedParserError = require('../../../structs/errors/FeedParserError.js')
const ArticleModel = require('../../../models/Article.js')
const VALID_SOURCE_KEYS_TYPES = {
  title: String,
  channel: String,
  message: String,
  checkTitles: Boolean,
  checkDates: Boolean,
  imgPreviews: Boolean,
  imgLinksExistence: Boolean,
  formatTables: Boolean,
  toggleRoleMentions: Boolean
}
const VALID_SOURCE_DEFAULTS = {
  message: config.feeds.defaultMessage,
  checkTitles: config.feeds.checkTitles,
  checkDates: config.feeds.checkDates,
  imgPreviews: config.feeds.imgPreviews,
  imgLinksExistence: config.feeds.imgLinksExistence,
  formatTables: config.feeds.formatTables,
  toggleRoleMentions: config.feeds.toggleRoleMentions
}
const VALID_SOURCE_KEYS = Object.keys(VALID_SOURCE_KEYS_TYPES)

function checkGuildFeedExists (req, res, next) {
  if (!req.guildRss || !req.guildRss.sources) return res.status(404).json({ code: 404, message: 'Unknown Feed' }) // req.guildRss handed over from the guild middleware
  const rssList = req.guildRss.sources
  for (const rssName in rssList) {
    const source = rssList[rssName]
    if (rssName === req.params.feedID) {
      req.source = source
      return next()
    }
  }
  return res.status(404).json({ code: 404, message: 'Unknown Feed' })
}

async function postFeed (req, res, next) {
  // Required keys in body are channel and feed
  try {
    const guildID = req.params.guildID
    const guildRss = req.guildRss
    const link = typeof req.body.link === 'string' ? req.body.link.trim() : req.body.link
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : req.body.title
    const channelID = typeof req.body.channel === 'string' ? req.body.channel.trim() : req.body.channel
    const errors = {}
    if (title && typeof title !== 'string') errors.title = 'Must be a string'

    if (!link) errors.link = 'This field is required'
    else if (typeof link !== 'string') errors.link = 'Must be a string'

    if (!channelID) errors.channel = 'This field is required'
    else if (typeof channelID !== 'string') errors.channel = 'Must be a string'

    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })

    const serverLimitData = await serverLimit(guildID)
    if (guildRss && guildRss.sources) {
      const rssList = guildRss.sources
      if (serverLimitData.max !== 0 && Object.keys(rssList).length + 1 > serverLimitData.max) return res.status(403).json({ code: 403, message: `Feed limit reached (${serverLimitData.max})` })
      for (const rssName in rssList) {
        const source = rssList[rssName]
        if (source.link === link && source.channel === channelID) return res.status(403).json({ code: 403, message: 'Feed already exists for this channel' })
      }
    }

    const fetchedChannel = await RedisChannel.fetch(channelID)
    if (!fetchedChannel) return res.status(404).json({ code: 404, message: 'Unknown Channel' })
    else if (fetchedChannel.guildID !== guildID) return res.status(403).json({ code: 403, message: { channel: 'Not part of guild' } })
    // const response = await axios.get(`${discordAPIConstants.apiHost}/channels/${channelID}`, BOT_HEADERS) // Check if the bot is able to see the channel
    // if (response.data.guild_id !== guildID) return res.status(403).json({ code: 403, message: { channel: 'Not part of guild' } })

    try {
      var guildName = req.guild.name
      const [ resolvedUrl, metaTitle, rssName ] = await initialize.addNewFeed({ link,
        channel: {
          id: channelID,
          guild: { id: guildID, name: guildName }
        } }, title)
      // log.web.info(`(${req.session.identity.id}, ${req.session.identity.username}) (${guildID}, ${guildName}) Added feed ${resolvedUrl}`)
      return res.status(201).json({ _rssName: rssName, title: metaTitle, channel: channelID, link: resolvedUrl })
    } catch (err) {
      // log.web.warning(`(${req.session.identity.id}, ${req.session.identity.username}) (${guildID}, ${guildName}) Unable to add feed ${link}`, err)
      if (err.message.includes('exists for this channel')) return res.status(403).json({ code: statusCodes['40003_FEED_EXISTS_IN_CHANNEL'].code, message: err.message })
      if (err instanceof RequestError) return res.status(500).json({ code: statusCodes['50042_FEED_CONNECTION_FAILED'].code, message: err.message })
      if (err instanceof FeedParserError && err.message.includes('valid feed')) return res.status(400).json({ code: statusCodes['40002_FEED_INVALID'].code, message: err.message })
      else {
        return next(err)
      }
    }
  } catch (err) {
    next(err)
  }
}

// This route will auto create the profile if it doesn't exist through initialize.addNewFeed
feeds.post('/', postFeed)
feeds.use('/:feedID', checkGuildFeedExists)

async function getFeedPlaceholders (req, res, next) {
  const dateSettings = {
    timezone: req.guildRss.timezone || config.feeds.timezone,
    format: req.guildRss.dateFormat || config.feeds.dateFormat,
    language: req.guildRss.dateLanguage || config.feeds.dateLanguage
  }
  try {
    const failedLinksStatus = await dbOpsFailedLinks.get(req.source.link)
    if (failedLinksStatus && failedLinksStatus.failed) return res.status(400).json({ code: statusCodes['40005_CONNECTION_FAILURE_LIMIT'], message: 'Reached connection failure limit' })

    const { articleList } = await FeedFetcher.fetchFeed(req.source.link)
    if (articleList.length === 0) return res.json([])
    const allPlaceholders = []
    for (const article of articleList) {
      const parsed = new Article(article, req.source, dateSettings)
      const articlePlaceholders = {}
      for (const placeholder of parsed.placeholders) {
        articlePlaceholders[placeholder] = parsed[placeholder]
      }
      articlePlaceholders._id = parsed.id
      articlePlaceholders._fullDescription = parsed._fullDescription
      articlePlaceholders._fullSummary = parsed._fullSummary
      articlePlaceholders._fullTitle = parsed._fullTitle
      articlePlaceholders._fullDate = parsed._fullDate

      const regexPlaceholders = parsed.regexPlaceholders
      for (const placeholder in regexPlaceholders) {
        for (const customName in regexPlaceholders[placeholder]) {
          articlePlaceholders[`regex:${placeholder}:${customName}`] = regexPlaceholders[placeholder][customName]
        }
      }

      const rawPlaceholders = parsed.getRawPlaceholders()
      for (const rawPlaceholder in rawPlaceholders) {
        articlePlaceholders[`raw:${rawPlaceholder}`] = rawPlaceholders[rawPlaceholder]
      }

      allPlaceholders.push(articlePlaceholders)
    }

    res.json(allPlaceholders)
  } catch (err) {
    if (err instanceof RequestError) return res.status(500).json({ code: statusCodes['50042_FEED_CONNECTION_FAILED'].code, message: err.message })
    if (err instanceof FeedParserError && err.message.includes('valid feed')) return res.status(400).json({ code: statusCodes['40002_FEED_INVALID'].code, message: err.message })
    next(err)
  }
}

async function getFeedDebug (req, res, next) {
  try {
    const guildID = req.params.guildID
    const shard = await RedisGuild.utils.getValue(guildID, 'shard') // -1 means no sharding
    const assignedSchedule = await dbOpsSchedules.assignedSchedules.get(req.params.feedID, shard)
    if (!assignedSchedule) return res.status(500).json({ code: 500, message: 'No schedule was assigned to feed' })
    const collectionID = ArticleModel.getCollectionID(req.source.link, shard === '-1' ? null : shard, assignedSchedule.schedule)
    const results = await ArticleModel.modelByID(collectionID).find({}).lean().exec()
    res.json(results)
  } catch (err) {
    next(err)
  }
}

async function deleteFeed (req, res, next) {
  try {
    const result = await dbOpsGuilds.removeFeed(req.guildRss, req.params.feedID)
    // log.web.info(`(${req.session.identity.id}, ${req.session.identity.username}) DELETE ${req.url} - Feed link ${req.source.link}`)
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
}

async function patchFeed (req, res, next) {
  try {
    const guildID = req.params.guildID
    const newSource = req.body
    const guildRss = req.guildRss
    const source = req.source
    const errors = {}

    for (const key in newSource) {
      if (!VALID_SOURCE_KEYS.includes(key)) errors[key] = `Invalid setting` // return res.status(400).json({ code: 400, message: { [key]: `Only [${VALID_SOURCE_KEYS.join(',')}] fields are supported` } })
      else if (typeof newSource[key] !== 'boolean' && !newSource[key]) errors[key] = 'Must be defined'
      else if (newSource[key].constructor !== VALID_SOURCE_KEYS_TYPES[key]) errors[key] = `Invalid type. Must be a ${newSource[key].constructor.name}`
      else source[key] = newSource[key]
    }
    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })
    for (const key in newSource) {
      if (key === 'channel') {
        const newChannel = newSource.channel
        if (!(await RedisChannel.utils.isChannelOfGuild(newChannel, guildID))) {
          return res.status(403).json({ code: 403, message: { channel: 'Not part of guild' } })
          // const channel = await axios.get(`${discordAPIConstants.apiHost}/channels/${newChannel}`, BOT_HEADERS) // Check if the bot is able to see the channel
          // if (channel.data.guild_id !== guildRss.id) errors[key] = 'Not part of guild' // return res.status(403).json({ code: 403, message: { channel: `Not part of guild` } })
        } else {
          if (newSource[key] === VALID_SOURCE_DEFAULTS[key]) delete source[key]
          else source[key] = newSource[key]
        }
      } else {
        if (newSource[key] === VALID_SOURCE_DEFAULTS[key]) delete source[key]
        else source[key] = newSource[key]
      }
    }
    const result = await dbOpsGuilds.update(guildRss)
    // log.web.info(`(${req.session.identity.id}, ${req.session.identity.username}) (${req.guildRss.id}, ${req.guildRss.name}) PATCH ${req.url} - Feed link ${req.source.link}`)
    req.patchResult = result
    next()
  } catch (err) {
    next(err)
  }
}

feeds.get('/:feedID/placeholders', getFeedPlaceholders)
feeds.get('/:feedID/debug', getFeedDebug)
feeds.delete('/:feedID', deleteFeed)
feeds.patch('/:feedID', patchFeed)

module.exports = {
  constants: {
    VALID_SOURCE_KEYS,
    VALID_SOURCE_KEYS_TYPES,
    VALID_SOURCE_DEFAULTS
  },
  middleware: {
    checkGuildFeedExists
  },
  routes: {
    postFeed,
    getFeedPlaceholders,
    getFeedDebug,
    deleteFeed,
    patchFeed
  },
  router: feeds
}

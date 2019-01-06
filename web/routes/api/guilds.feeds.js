const express = require('express')
const feeds = express.Router({ mergeParams: true })
const axios = require('axios')
const statusCodes = require('../../constants/codes.js')
const discordAPIConstants = require('../../constants/discordAPI.js')
const dbOps = require('../../../util/dbOps')
const initialize = require('../../../rss/initialize.js')
const VALID_SOURCE_KEYS = ['title', 'channel']
const BOT_HEADERS = require('../../constants/discordAPIHeaders.js').bot
const serverLimit = require('../../../util/serverLimit.js')

async function checkGuildFeedExists (req, res, next) {
  try {
    if (!req.guildRss) return res.status(404).json({ code: 404, message: 'Unknown Guild Profile' })
    const rssList = req.guildRss.sources // req.guildRss handed over from the guild middleware
    if (!rssList) return res.status(404).json({ code: 404, message: 'Unknown Feed' })
    for (const rssName in rssList) {
      const source = rssList[rssName]
      if (rssName === req.params.feedId) {
        req.source = source
        return next()
      }
    }
    return res.status(404).json({ code: 404, message: 'Unknown Feed' })
  } catch (err) {
    next(err)
  }
}

// This route will auto create the profile if it doesn't exist through initialize.addNewFeed
feeds.post('/', async (req, res, next) => {
  // Required keys in body are channel and feed
  try {
    const guildId = req.params.guildId
    const { feed } = req.body
    const channelId = req.body.channel
    const [ guildRss, serverLimitData ] = await Promise.all([ dbOps.guildRss.get(guildId), serverLimit(guildId) ])
    if (guildRss && guildRss.sources) {
      const rssList = guildRss.sources
      if (serverLimitData.max !== 0 && Object.keys(rssList).length + 1 > serverLimitData.max) return res.status(403).json({ code: 403, message: `Guild feed limit reached (${serverLimitData.max})` })
      for (const rssName in rssList) {
        const source = rssList[rssName]
        if (source.link === feed && source.channel === channelId) return res.status(400).json({ code: 400, message: 'Feed already exists for this channel' })
      }
    }
    const returnBody = {}
    if (!feed) returnBody.feed = 'This field is required'
    if (!channelId) returnBody.channel = 'This field is required'
    else {
      const channel = await axios.get(`${discordAPIConstants.apiHost}/channels/${channelId}`, BOT_HEADERS) // Check if the bot is able to see the channel
      if (channel.data.guild_id !== guildId) return res.status(403).json({ code: 403, message: { channel: 'Not part of guild' } })
    }

    if (Object.keys(returnBody).length > 0) return res.status(400).json({ code: 400, message: returnBody })
    let link, metaTitle, rssName
    try {
      [ link, metaTitle, rssName ] = await initialize.addNewFeed({ link: feed,
        channel: {
          id: channelId,
          guild: { id: guildId, name: req.guildName } // req.guildName is provided in checkUserGuildPermission
        } })
    } catch (err) {
      if (err.message.includes('exists for this channel')) return res.status(403).json({ code: statusCodes['40003_FEED_EXISTS_IN_CHANNEL'].code, message: err.message })
      if (err.message.includes('Connection failed')) return res.status(500).json({ code: statusCodes['50042_FEED_CONNECTION_FAILED'].code, message: err.message })
      else if (err.message.includes('valid feed')) return res.status(400).json({ code: statusCodes['40002_FEED_INVALID'].code, message: err.message })
      else return next(err)
    }

    req.guildRss = await dbOps.guildRss.get(guildId)
    return res.status(201).json({ _rssName: rssName, title: metaTitle, channel: channelId, link })
  } catch (err) {
    next(err)
  }
})

feeds.use('/:feedId', checkGuildFeedExists)

feeds.delete('/:feedId', async (req, res, next) => {
  try {
    const result = await dbOps.guildRss.removeFeed(req.guildRss, req.params.feedId)
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
})

feeds.patch('/:feedId', async (req, res, next) => {
  try {
    const newSource = req.body
    const guildRss = req.guildRss
    const source = req.source
    const errors = {}

    for (const key in newSource) {
      if (!VALID_SOURCE_KEYS.includes(key)) errors[key] = `Only [${VALID_SOURCE_KEYS.join(',')}] fields are allowed` // return res.status(400).json({ code: 400, message: { [key]: `Only [${VALID_SOURCE_KEYS.join(',')}] fields are supported` } })
      else if (!newSource[key]) errors[key] = 'Must not be empty'
      else if (Object.keys(errors).length === 0) {
        if (key === 'channel') {
          const newChannel = newSource[key]
          const channel = await axios.get(`${discordAPIConstants.apiHost}/channels/${newChannel}`, BOT_HEADERS) // Check if the bot is able to see the channel
          if (channel.data.guild_id !== guildRss.id) errors[key] = 'Not part of guild' // return res.status(403).json({ code: 403, message: { channel: `Not part of guild` } })
          else source[key] = newSource[key]
        } else source[key] = newSource[key]
      }
    }
    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })
    const result = await dbOps.guildRss.update(guildRss, true)
    req.patchResult = result
    next()
  } catch (err) {
    next(err)
  }
})

module.exports = feeds

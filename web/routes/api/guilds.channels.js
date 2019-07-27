const express = require('express')
const channels = express.Router({ mergeParams: true })
const RedisChannel = require('../../../structs/db/Redis/Channel.js')

async function getChannels (req, res, next) {
  const guildID = req.params.guildID
  try {
    const channelIDs = await RedisChannel.utils.getChannelsOfGuild(guildID)
    const channels = await Promise.all(channelIDs.map(id => RedisChannel.fetch(id)))
    res.json(channels.map(channel => channel.toJSON()))
  } catch (err) {
    next(err)
  }
}

async function getChannelWithID (req, res, next) {
  const channelID = req.params.channelID
  const guildID = req.params.guildID
  try {
    const redisChannel = await RedisChannel.fetch(channelID)
    if (!redisChannel) {
      return res.status(404).json({ code: 404, message: 'Not found' })
    }
    if (redisChannel.guildID !== guildID) {
      return res.status(403).json({ code: 403, message: 'Forbidden' })
    }
    return res.json(redisChannel.toJSON())
    // log.web.info(`[1 DISCORD API REQUEST] [BOT] GET /api/guilds/:guildID/channels/:channelID`)
    // const response = await axios.get(`${discordAPIConstants.apiHost}/channels/${channelID}`, BOT_HEADERS)
    // if (response.data.guild_id !== guildID) return res.status(403).json({ code: 403, message: { channel: 'Not part of guild' } })
  } catch (err) {
    next(err)
  }
}

channels.get('/', getChannels)
channels.get('/:channelID', getChannelWithID)

module.exports = {
  routes: {
    getChannelWithID,
    getChannels
  },
  router: channels
}

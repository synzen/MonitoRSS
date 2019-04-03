const express = require('express')
const channels = express.Router({ mergeParams: true })
const redisOps = require('../../../util/redisOps.js')
const log = require('../../../util/logger.js')

// All API routes tries to mirror Discord's own API routes

async function getChannelWithId (req, res, next) {
  const channelId = req.params.channelId
  const guildId = req.params.guildId
  try {
    const [ isChannelOfGuild, channelName ] = await Promise.all([
      redisOps.channels.isChannelOfGuild(channelId, guildId),
      redisOps.channels.getName(channelId)
    ])
    if (isChannelOfGuild) {
      if (!channelName) log.web.warning(`[API] Missing channel name when channel is stored as part of guild in Redis (Guild ${guildId}, Channel ${channelId})`)
      return res.json({ id: channelId, name: channelName })
    } else return res.status(404).json({ code: 404, message: 'Not found' })
    // log.web.info(`[1 DISCORD API REQUEST] [BOT] GET /api/guilds/:guildId/channels/:channelId`)
    // const response = await axios.get(`${discordAPIConstants.apiHost}/channels/${channelId}`, BOT_HEADERS)
    // if (response.data.guild_id !== guildId) return res.status(403).json({ code: 403, message: { channel: 'Not part of guild' } })
  } catch (err) {
    next(err)
  }
}

async function getChannels (req, res, next) {
  const guildId = req.params.guildId
  try {
    const channelIds = await redisOps.channels.getChannelsOfGuild(guildId)
    const promises = []
    for (const id of channelIds) promises.push(redisOps.channels.getName(id))
    const channelNames = await Promise.all(promises)
    // const response = await axios.get(`${discordAPIConstants.apiHost}/guilds/${req.params.guildId}/channels`, BOT_HEADERS)
    const toReturn = channelNames.map((name, index) => {
      return { id: channelIds[index], name }
    })
    res.json(toReturn)
  } catch (err) {
    next(err)
  }
}

channels.get('/:channelId', getChannelWithId)
channels.get('/', getChannels)

module.exports = {
  routes: {
    getChannelWithId,
    getChannels
  },
  router: channels
}

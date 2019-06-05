const Discord = require('discord.js')
const redisOps = require('../util/redisOps.js')
const log = require('../util/logger.js')

module.exports = channel => {
  if (channel instanceof Discord.GuildChannel) redisOps.channels.recognize(channel).catch(err => log.general.error(`Redis failed to recognize after channelCreate event`, channel, err))
}

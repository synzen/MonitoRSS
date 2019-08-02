const Discord = require('discord.js')
const RedisChannel = require('../structs/db/Redis/Channel.js')
const log = require('../util/logger.js')

module.exports = channel => {
  if (channel instanceof Discord.GuildChannel) RedisChannel.utils.recognize(channel).catch(err => log.general.error(`Redis failed to recognize after channelCreate event`, channel, err))
}

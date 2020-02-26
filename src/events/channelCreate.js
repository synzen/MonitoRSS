const Discord = require('discord.js')
const RedisChannel = require('../structs/db/Redis/Channel.js')
const createLogger = require('../util/logger/create.js')

module.exports = channel => {
  if (channel instanceof Discord.GuildChannel) {
    RedisChannel.utils.recognize(channel)
      .catch(err => {
        const log = createLogger(channel.guild.shard.id)
        log.error(err, `Redis failed to recognize after channelCreate event`)
      })
  }
}

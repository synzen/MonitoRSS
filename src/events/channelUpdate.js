const Discord = require('discord.js')
const RedisChannel = require('../structs/db/Redis/Channel.js')
const createLogger = require('../util/logger/create.js')

module.exports = async (oldChannel, newChannel) => {
  if (!(newChannel instanceof Discord.GuildChannel) || !(oldChannel instanceof Discord.GuildChannel)) {
    return
  }
  if (oldChannel.name !== newChannel.name) {
    RedisChannel.utils.update(oldChannel, newChannel)
      .catch(err => {
        const log = createLogger(oldChannel.guild.shard.id)
        log.error(err, `Redis failed to update name after channelUpdate event`)
      })
  }
}

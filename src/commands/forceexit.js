const channelTracker = require('../util/channelTracker.js')
const createLogger = require('../util/logger/create.js')

module.exports = (message) => {
  if (channelTracker.hasActiveMenus(message.channel.id)) {
    channelTracker.remove(message.channel.id)
    message.react('☑').catch(err => {
      const log = createLogger(message.guild.shard.id)
      log.warn(err, 'Unable to react checkmark for successful forceexit')
      message.channel.send('Successfully cleared this channel from active status.')
        .catch(err => {
          const log = createLogger(message.guild.shard.id)
          log.warn(err, 'forceexit')
        })
    })
  } else {
    message.react('❌').catch(err => {
      const log = createLogger(message.guild.shard.id)
      log.warn(err, 'Unable to react xmark for failed forceexit')
    })
  }
}

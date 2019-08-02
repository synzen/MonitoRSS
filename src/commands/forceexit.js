const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')

module.exports = (bot, message) => {
  if (channelTracker.hasActiveMenus(message.channel.id)) {
    channelTracker.remove(message.channel.id)
    message.react('☑').catch(err => {
      log.command.warning(`Unable to react checkmark for successful forceexit`, message.guild, err)
      message.channel.send(`Successfully cleared this channel from active status.`).catch(err => log.comamnd.warning('forceexit', message.guild, err))
    })
  } else message.react('❌').catch(err => log.command.warning(`Unable to react xmark for failed forceexit`, message.guild, err))
}

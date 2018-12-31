const packageJson = require('../package.json')
const log = require('../util/logger.js')

module.exports = async (bot, message, command) => {
  try {
    await message.channel.send(packageJson.version)
  } catch (err) {
    log.command.warning('rssversion', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssversion 1', message.guild, err))
  }
}

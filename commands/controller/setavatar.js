const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  try {
    await bot.user.setAvatar(content[0])
    log.controller.success(`Changed avatar `)
    await message.channel.send('Successfully changed avatar.')
  } catch (err) {
    log.controller.warning('setavatar', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('setavatar 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

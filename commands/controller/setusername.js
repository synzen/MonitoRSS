const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  let username = content.join(' ')
  const original = bot.user.username
  try {
    const u = await bot.user.setUsername(username)
    log.controller.success(`Bot usename changed from ${original} to ${u.username}`)
    message.channel.send(`Bot username has been changed from ${original} to ${u.username}.`)
  } catch (err) {
    log.controller.warning('setusername', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('setusername 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

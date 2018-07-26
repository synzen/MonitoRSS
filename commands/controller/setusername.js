const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  let username = content.join(' ')
  const original = bot.user.username
  bot.user.setUsername(username)
    .then(c => {
      log.controller.success(`Bot usename changed from ${original} to ${c.user.username}`)
      message.channel.send(`Bot username has been changed from ${original} to ${c.user.username}.`)
    })
    .catch(err => {
      log.controller.warning(`Unable to change username from ${original} to ${username}`, message.author, err)
      message.channel.send(`Unable to change username from ${original} to ${username} (${err.message})`)
    })
}

exports.sharded = exports.normal

const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  let username = content.join(' ')
  bot.user.setUsername(username).catch(err => log.controller.warning(`Unable to set username`, message.author, err))
}

exports.sharded = exports.normal

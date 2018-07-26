const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  bot.user.setAvatar(content[0])
    .then(c => {
      log.controller.success(`Changed avatar `)
      message.channel.send('Successfully changed avatar.')
    })
    .catch(err => log.controller.warning(`Unable to set avatar`, message.author, err))
}

exports.sharded = exports.normal

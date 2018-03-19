const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  bot.user.setAvatar(content[0]).catch(err => log.controller.warning(`Unable to set avatar`, message.author, err))
}

exports.sharded = (bot, message) => {
  bot.shard.broadcastEval(`
    const appDir = require('path').dirname(require.main.filename);
    const log = require(appDir + 'util/logger.js');
    const content = '${message.content}'.split(' ');
    if (content.length > 1) {
      content.shift()
      bot.user.setAvatar(content[0]).catch(err => log.controller.warning('Unable to set avatar', err))
    }
  `).catch(err => log.controller.warning(`Unable to broadcast eval setavatar`, message.author, err))
}


exports.normal = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  bot.user.setAvatar(content[0]).catch(err => console.log(`Bot Controller: Unable to set avatar. `, err.message || err))
}

exports.sharded = function (bot, message) {
  bot.shard.broadcastEval(`
    const content = '${message.content}'.split(' ');
    if (content.length > 1) {
      content.shift()
      bot.user.setAvatar(content[0]).catch(err => console.log('Bot Controller: Unable to set avatar. ', err.message || err))
    }
  `).catch(err => console.log(`Bot Controller: Unable to broadcast eval setavatar. `, err.message || err))
}

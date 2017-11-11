
exports.normal = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  let username = content.join(' ')
  bot.user.setUsername(username).catch(err => console.log(`Bot Controller: Unable to set username. (${err})`))
}

exports.sharded = exports.normal

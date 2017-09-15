module.exports = function(bot, message) {
  if (message.content === '~mycustomcommand') message.channel.send('I saw your custom command!')
}

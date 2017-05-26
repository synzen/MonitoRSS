const channelTracker = require('../util/channelTracker.js')

module.exports = function (bot, message) {
  if (channelTracker.hasActiveMenus(message.channel.id)) {
    channelTracker.remove(message.channel.id)
    message.react('☑').catch(function (err) {
      console.log(`Promise Warning: forceexit 1: Unable to react checkmark for successful forceexit (${err})`)
      message.channel.send(`Successfully cleared this channel from active status.`)
    })
  } else message.react('❌').catch(err => console.log(`Promise Warning: forceexit 2: Unable to react xmark for failed forceexit (${err})`))
}

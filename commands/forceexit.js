const channelTracker = require('../util/channelTracker.js')

module.exports = function(bot, message) {
  if (channelTracker.hasActiveMenus(message.channel.id)) {
    channelTracker.remove(message.channel.id);
    message.channel.send(`Successfully cleared this channel from active status.`);
  }
}

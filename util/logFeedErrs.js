const logFeedErrs = require('../config.json').logging.showFeedErrs

module.exports = function(channel, err) {
  if (!logFeedErrs) return;
  if (channel) console.log(`RSS Error: (${channel.guild.id}, ${channel.guild.name}) => Skipping ${err.feed.link}. (${err.content})`);
  else console.log(`RSS Error: Skipping ${err.link}. (${err.content})`);
}

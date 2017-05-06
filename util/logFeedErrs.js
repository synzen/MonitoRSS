const logFeedErrs = require('../config.json').logging.showFeedErrs

module.exports = function(err, linkOnly) {
  if (!logFeedErrs) return;
  // if (channel) console.log(`RSS Error: (${channel.guild.id}, ${channel.guild.name}) => Skipping ${err.feed.link}. (${err.content})`);
  if (linkOnly) console.log(`RSS Error: Skipping all feeds with link ${err.link}. (${err.content})`);
  else console.log(`RSS Error: (${err.feed.guildId}) => Skipping ${err.link} for channel ${err.feed.channel}. (${err.content})`);
}

// Check for invalid configs on startup and at the beginning of each feed retrieval cycle
const config = require('../config.json')
const currentGuilds = require('./storage').currentGuilds

exports.checkExists = function(rssName, feed, logging, initializing) {
  let valid = true

  if (feed.enabled == 0) {
    if (logging) console.log(`RSS Config Info: ${rssName} is disabled in channel ${feed.channel}, skipping...`);
    return false;
  }

  if (!feed.link || !feed.link.startsWith('http')){
    if (logging) console.log(`RSS Config Warning: ${rssName} has no valid link defined, skipping...`);
    valid = false;
  }
  else if (!feed.channel) {
    if (logging) console.log(`RSS Config Warning: ${rssName} has no channel defined, skipping...`);
    valid = false;
  }

  return valid;

}

exports.validChannel = function(bot, guildId, feed) {
  const channel = bot.channels.has(feed.channel);
  const guild = bot.guilds.get(guildId)

  if (!channel) {
    console.log(`RSS Config Warning: (${guildId}, ${guild.name}) => ${feed.link}'s channel was not found. skipping...`)
    return false;
  }
  else return true;

}

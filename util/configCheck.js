// Check for invalid configs on startup and at the beginning of each feed retrieval cycle

const config = require('../config.json')

exports.checkExists = function (guildId, rssName, logging, initializing) {
  var guild = require(`../sources/${guildId}.json`)
  var rssList = guild.sources

  var valid = true;

  if (rssList[rssName].enabled == 0) {
    console.log(`RSS Config Info: (${guild.id}, ${guild.name}) => Feed '${rssList[rssName].link}' is disabled in channel ${rssList[rssName].channel}, skipping...`);
    return false;
  }

  if (!rssList[rssName].link || !rssList[rssName].link.startsWith('http')){
    if (logging) console.log(`RSS Config Warning: (${guild.id}, ${guild.name}) => ${rssList[rssName].link} has no valid link defined, skipping...`);
    valid = false;
  }
  else if (!rssList[rssName].channel) {
    if (logging) console.log(`RSS Config Warning: (${guild.id}, ${guild.name}) => ${rssList[rssName].link} has no channel defined, skipping...`);
    valid = false;
  }

  return valid;

}

exports.validChannel = function (bot, guildId, rssName) {
  var guildRss = require(`../sources/${guildId}.json`)
  var rssList = guildRss.sources

  if (isNaN(parseInt(rssList[rssName].channel,10))) {
    var channel = bot.channels.find('name', rssList[rssName].channel);
    if (!channel) {
      console.log(`RSS Config Warning: (${guildRss.id}, ${guildRss.name}) => ${rssName}'s string-defined channel was not found, skipping...`)
      return false;
    }
    else return channel;
  }
  else {
    var channel = bot.channels.get(`${rssList[rssName].channel}`);
    if (!channel) {
      console.log(`RSS Config Warning: (${guildRss.id}, ${guildRss.name}) => ${rssName}'s integer-defined channel was not found. skipping...`)
      return false;
    }
    else return channel;
  }

}

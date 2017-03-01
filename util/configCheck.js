const config = require('../config.json')

exports.checkExists = function (guildId, rssIndex, logging, initializing) {
  var guild = require(`../sources/${guildId}.json`)
  var rssList = guild.sources

  var valid = true;

  if (rssList[rssIndex].enabled == 0) {
    console.log(`RSS Config Info: (${guild.id}, ${guild.name}) => Feed '${rssList[rssIndex].link}' is disabled in channel ${rssList[rssIndex].channel}, skipping...`);
    return false;
  }

  if ((!rssList[rssIndex].name) && rssList.length !== 0){
    if (logging) console.log(`RSS Config Warning: (${guild.id}, ${guild.name}) => Feed #${parseInt(rssIndex,10) + 1} has no name defined, skipping...`);
    valid = false;
  }
  else if (!rssList[rssIndex].link || !rssList[rssIndex].link.startsWith('http')){
    if (logging) console.log(`RSS Config Warning: (${guild.id}, ${guild.name}) => ${rssList[rssIndex].link} has no valid link defined, skipping...`);
    valid = false;
  }
  else if (!rssList[rssIndex].channel) {
    if (logging) console.log(`RSS Config Warning: (${guild.id}, ${guild.name}) => ${rssList[rssIndex].link} has no channel defined, skipping...`);
    valid = false;
  }

  return valid;

}

exports.validChannel = function (bot, guildId, rssIndex) {
  var guildRss = require(`../sources/${guildId}.json`)
  var rssList = guildRss.sources

  if (isNaN(parseInt(rssList[rssIndex].channel,10))) {
    var channel = bot.channels.find('name', rssList[rssIndex].channel);
    if (!channel) {
      console.log(`RSS Config Warning: (${guildRss.id}, ${guildRss.name}) => ${rssList[rssIndex].name}'s string-defined channel was not found, skipping...`)
      return false;
    }
    else return channel;
  }
  else {
    var channel = bot.channels.get(`${rssList[rssIndex].channel}`);
    if (!channel) {
      console.log(`RSS Config Warning: (${guildRss.id}, ${guildRss.name}) => ${rssList[rssIndex].name}'s integer-defined channel was not found. skipping...`)
      return false;
    }
    else return channel;
  }

}

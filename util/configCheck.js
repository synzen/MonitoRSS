
exports.checkExists = function (guildId, rssIndex, logging, initializing) {
  var guild = require(`../sources/${guildId}.json`)
  var rssList = guild.sources

  var rssConfig = require('../config.json')

  var valid = true;

  if (rssConfig.defaultMessage == null || rssConfig.defaultMessage == "") {
    console.log(`RSS Config Warning: A default message must be set in config before continuing.`);
    return false;
  }
  else if (rssList[rssIndex].enabled == 0) {
    console.log(`RSS Config Info: (${guild.id}, ${guild.name}) => Feed "${rssList[rssIndex].link}" is disabled in channel ${rssList[rssIndex].channel}, skipping...`);
    return false;
  }

  if ((rssList[rssIndex].name == null || rssList[rssIndex].name == "") && rssList.length !== 0){
    if (logging) console.log(`RSS Config Warning: (${guild.id}, ${guild.name}) => Feed #${parseInt(rssIndex,10) + 1} has no name defined, skipping...`);
    valid = false;
  }
  else if (rssList[rssIndex].link == null || !rssList[rssIndex].link.startsWith("http")){
    if (logging) console.log(`RSS Config Warning: (${guild.id}, ${guild.name}) => ${rssList[rssIndex].link} has no valid link defined, skipping...`);
    valid = false;
  }
  else if (rssList[rssIndex].channel == null) {
    if (logging) console.log(`RSS Config Warning: (${guild.id}, ${guild.name}) => ${rssList[rssIndex].link} has no channel defined, skipping...`);
    valid = false;
  }
  // else if (rssList[rssIndex].message == null){
  //   if (logging && initializing) console.log(`RSS Config Info: ${rssList[rssIndex].name} has no Message defined, using default message...`);
  //   valid = true;
  // }

  return valid;

}

exports.validChannel = function (bot, guildId, rssIndex) {
  var guildRss = require(`../sources/${guildId}.json`)
  var rssList = guildRss.sources

  if (isNaN(parseInt(rssList[rssIndex].channel,10))) {
    var channel = bot.channels.find("name", rssList[rssIndex].channel);
    if (channel == null) {
      console.log(`RSS Config Warning: (${guildRss.id}, ${guildRss.name}) => ${rssList[rssIndex].link}'s string-defined channel was not found, skipping...`);
      return false;
    }
    else return channel;
  }
  else {
    var channel = bot.channels.get(`${rssList[rssIndex].channel}`);
    if (channel == null) {
      console.log(`RSS Config Warning: (${guildRss.id}, ${guildRss.name}) => ${rssList[rssIndex].link}'s integer-defined channel was not found. skipping...`);
      return false;
    }
      else return channel;
  }


}

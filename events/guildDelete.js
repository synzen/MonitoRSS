var rssConfig = require('../config.json')
//var guildList = rssConfig.sources
const sqlCmds = require('../rss/sql/commands.js')
const update = require('../util/updateJSON.js')
const fs = require('fs')

module.exports = function (bot, guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has removed the bot.`)
  bot.channels.get('267436614110806024').sendMessage(`Guild Info: "${guild.name}" has been removed.\nUsers: ${guild.members.size}\nOwner: ${guild.owner} (${guild.owner})`)

  if (!fs.existsSync(`./sources/${guild.id}.json`)) return;
  else var rssList = require(`../sources/${channel.guild.id}.json`).sources;

  for (let rssIndex in rssList) {
    sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name)
  }

  fs.unlink(`./sources/${guild.id}.json`, function() {
    console.log(`RSS Info: Guild entry ${guild.id} (${guild.name}) deleted.`)
  })//delete rssConfig.sources[message.guild.id];

  //update('./config.json', rssConfig)
}

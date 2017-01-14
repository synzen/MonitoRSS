var rssConfig = require('../config.json')
//var guildList = rssConfig.sources
const sqlCmds = require('../rss/sql/commands.js')
const update = require('../util/updateJSON.js')
const fs = require('fs')

module.exports = function (bot, guild) {
  if (!fs.existsSync(`./sources/${guild.guild.id}.json`)) return;
  else var rssList = require(`../sources/${channel.guild.id}.json`).sources;

  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has removed the bot.`)

  for (let rssIndex in rssList) {
    sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name)
  }

  fs.unlink(`./sources/${guild.id}.json`, function() {
    console.log(`RSS Info: Guild entry ${guild.id} (${guild.name}) deleted.`)
  })//delete rssConfig.sources[message.guild.id];

  //update('./config.json', rssConfig)
}

var rssConfig = require('../config.json')
//var guildList = rssConfig.sources
const sqlCmds = require('../rss/sql/commands.js')
const update = require('../util/updateJSON.js')
const fs = require('fs')

module.exports = function (bot, guild) {

  if (!fs.existsSync(`./sources/${guild.id}.json`)) return;
  else var rssList = require(`../sources/${guild.id}.json`).sources;

  for (let rssIndex in rssList) {
    sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name)
  }

  fs.unlink(`./sources/${guild.id}.json`, function() {
    console.log(`Guild Info: Guild "${guild.name}" (Users: ${guild.members.size}) has left and its records have been deleted.`)
  })

}

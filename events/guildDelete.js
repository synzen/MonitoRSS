var rssConfig = require('../config.json')
const sqlCmds = require('../rss/sql/commands.js')
const update = require('../util/updateJSON.js')
const fileOps = require('../util/updateJSON.js')

module.exports = function (bot, guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has removed the bot.`)

  if (!fileOps.exists(`./sources/${guild.id}.json`)) return;
  else var rssList = require(`../sources/${guild.id}.json`).sources;

  for (let rssIndex in rssList) {
    sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name, function() {})
  }

  fileOps.deleteFile(`./sources/${guild.id}.json`, `../sources/${guild.id}.json`, function() {
    return console.log(`RSS Info: Guild entry ${guild.id} (${guild.name}) deleted.`)
  })
}

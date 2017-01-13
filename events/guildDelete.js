var rssConfig = require('../config.json')
var guildList = rssConfig.sources
const sqlCmds = require('../rss/sql/commands.js')
const update = require('../util/updateJSON.js')

module.exports = function (bot, guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has removed the bot.`)

  for (let rssIndex in rssConfig.sources[guild.id]) {
    sqlCmds.dropTable(rssConfig.databaseName, rssConfig.sources[guild.id][rssIndex])
  }

  delete rssConfig.sources[guild.id]
  update('./config.json', rssConfig)
}

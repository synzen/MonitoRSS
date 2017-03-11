const fileOps = require('../util/fileOps.js')
const currentGuilds = require('../util/fetchInterval.js').currentGuilds

module.exports = function (bot, oldGuild, newGuild) {
  if (!currentGuilds[oldGuild.id]) return;
  const guildRss = currentGuilds[oldGuild.id]
  guildRss.name = newGuild.name
  fileOps.updateFile(oldGuild.id, guildRss)
  console.log(`Guild Info: (${oldGuild.id}, ${oldGuild.name}) => Name change detected, changed guild name from "${oldGuild.name}" to "${newGuild.name}".`)
}

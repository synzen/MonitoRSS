const fileOps = require('../util/fileOps.js')

module.exports = function (bot, oldGuild, newGuild) {
  var newGuildInfo = require(`../sources/${oldGuild.id}.json`);
  newGuildInfo.name = newGuild.name;
  fileOps.fileOpsFile(oldGuild.id, newGuildInfo, `./sources/${oldGuild.id}.json`);
  console.log(`Guild Info: (${oldGuild.id}, ${oldGuild.name}) => Name change detected, changed guild name from "${oldGuild.name}" to "${newGuild.name}".`);
}

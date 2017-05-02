// Handle file operations and to accomodate communications between the RSS module and
// the commands module.

const fs = require('fs')
const currentGuilds = require('./storage.js').currentGuilds
const config = require('../config.json')

function updateContent(guildId, inFile) {
  if (process.env.isCmdServer) process.send({type: 'guildUpdate', id: guildId, contents: inFile}); //child process
  fs.writeFileSync(`./sources/${guildId}.json`, JSON.stringify(inFile, null, 2))
}

exports.updateFile = function(guildId, inFile) { // "inFile" is the new contents in memory
  if (fs.existsSync(`./sources/${guildId}.json`)) { // Back up the file first if possible
    fs.readFile(`./sources/${guildId}.json`, function (err, data) {
      if (err) throw err;
      fs.writeFileSync(`./sources/backup/${guildId}.json`, JSON.stringify(data, null, 2))
      updateContent(guildId, inFile)
    });
  }
  else updateContent(guildId, inFile);
}

exports.deleteFile = function(guildId, callback) {
  try {
    fs.unlinkSync(`./sources/${guildId}.json`)
    callback()
  } catch (e) {}
  delete currentGuilds[guildId]
  if (process.env.isCmdServer) process.send({type: 'guildDeletion', id: guildId});
}

exports.isEmptySources = function(guildRss) {
  // Used on the beginning of each cycle to check for empty sources per guild
  if (!guildRss.sources || guildRss.sources.size() === 0) {
     if (!guildRss.timezone && guildRss.limitOverride == null) { // Delete only if server-specific special settings are not found
       exports.deleteFile(guildRss.id, `../sources/${guildRss.id}.json`, function() {
         console.log(`RSS Info: (${guildRss.id}) => 0 sources found with no custom settings, deleting.`)
       });
     }
     else console.log(`RSS Info: (${guildRss.id}) => 0 sources found, skipping.`);
     return true;
  }
  else return false;
}

exports.checkBackup = function(err, guildId) {
  if (config.feedManagement.enableBackups !== true) return console.log(`Guild Profile Warning: Cannot load guild profile ${guildId} (${err}). Backups disabled, skipping profile..`);

  console.log(`Guild Profile Warning: Cannot load guild profile ${guildId} (${err}). Backups enabled, attempting to restore backup.`);

  fs.readFile(`./sources/backup/${guildId}`, function(err, backup) {
    if (err) return console.log(`Guild Profile Warning: Unable to restore backup for ${guildId}. (${err})`);
    updateContent(guildId, backup, `../sources/${guildId}.json`);
    console.log(`Guild Profile Info: Successfully restored backup for ${guildId}`);
  })
}

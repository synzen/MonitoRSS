// Handle file operations and to accomodate communications between the RSS module and
// the commands module.

const fs = require('fs')
const currentGuilds = require('./fetchInterval.js').currentGuilds
const config = require('../config.json')

function updateContent(guildId, inFile, cacheLoc) {
  if (process.env.isCmdServer) process.send({type: 'update', id: guildId, contents: inFile}); //child process
  fs.writeFileSync(`./sources/${guildId}.json`, JSON.stringify(inFile, null, 2))
}

exports.exists = function(file) {
  return fs.existsSync(file)
}

exports.updateFile = function(guildId, inFile, cacheLoc) { // "inFile" is the new contents in memory, cacheLoc is the cache location of the file
  if (fs.existsSync(`./sources/${guildId}.json`)) { // Back up the file first if possible
    fs.readFile(`./sources/${guildId}.json`, function (err, data) {
      if (err) throw err;
      fs.writeFileSync(`./sources/backup/${guildId}.json`, JSON.stringify(data, null, 2))
      updateContent(guildId, inFile, cacheLoc)
    });
  }
  else updateContent(guildId, inFile, cacheLoc);
}

exports.deleteFile = function(guildId, cacheLoc, callback) {
  try {
    fs.unlinkSync(`./sources/${guildId}.json`)
    callback()
  } catch (e) {}
  delete currentGuilds[guildId]
  if (process.env.isCmdServer) process.send({type: 'deletion', id: guildId});
}

exports.isEmptySources = function(guildRss) {
  // Used on the beginning of each cycle to check for empty sources per guild
  if (!guildRss.sources || guildRss.sources.size() === 0) {
     if (!guildRss.timezone) { // Delete only if a timezone is not found, preserving the customization
       exports.deleteFile(guildRss.id, `../sources/${guildRss.id}.json`, function() {
         console.log(`RSS Info: (${guildRss.id}) => 0 sources found, deleting.`)
       });
     }
     else console.log(`RSS Info: (${guildRss.id}) => 0 sources found, skipping.`)
     return true;
  }
  else return false;
}

exports.readDir = function(dir, callback) {
  return fs.readdir(dir, callback)
}

exports.checkBackup = function(err, guildId) {
  if (config.feedManagement.enableBackups !== true) return console.log(`Guild Profile Warning: Cannot load guild profile ${guildId} (${err}). Backups disabled, skipping profile..`);

  console.log(`Guild Profile Warning: Cannot load guild profile ${guildId} (${err}). Backups enabled, attempting to restore backup.`);

  fs.readFile(`./sources/backup/${guildId}`, function(err, backup) {
    if (err) return console.log(`Guild Profile Warning: Unable to restore backup for ${guildId}. (${err})`);
    updateContent(guildId, backup, `../sources/${guildId}.json`);
    console.log(`Guild Profile Info: Successfully restored backup for ${guildId}`);
  })

  //
  // try {var backup = require(`../sources/backup/${guildId}`)}
  // catch (e) {return console.log(`RSS Warning: Unable to restore backup for ${guildId}. Reason: ${e}`)}
  //
  // updateContent(guildId, backup, `../sources/${guildId}`);
  // console.log(`Guild Profile: Successfully restored backup of ${guildId}`);
}

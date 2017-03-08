// Handle file operations and to accomodate communications between the RSS module and
// the commands module.

const fs = require('fs');
const config = require('../config.json')

function updateContent(realFile, inFile, cacheLoc) {
  if (process.env.isCmdServer) process.send({id: realFile, contents: inFile}); //child process
  fs.writeFileSync(`./sources/${realFile}.json`, JSON.stringify(inFile, null, 2))
  try {delete require.cache[require.resolve(cacheLoc)]} catch (e) {}
}

exports.exists = function (file) {
  return fs.existsSync(file)
}

exports.updateFile = function (guildId, inFile, cacheLoc) {
  // "inFile" is the new contents in memory, cacheLoc is the cache location of the file
  if (fs.existsSync(`./sources/${guildId}.json`)) { // Back up the file first if possible
    fs.readFile(`./sources/${guildId}.json`, function (err, data) {
      if (err) throw err;
      fs.writeFileSync(`./sources/backup/${guildId}.json`, data)
      updateContent(guildId, inFile, cacheLoc)
    });
  }
  else updateContent(guildId, inFile, cacheLoc);
}

exports.deleteFile = function (guildId, cacheLoc, callback) {
  try {fs.unlinkSync(`./sources/${guildId}.json`)} catch (e) {}
  try {delete require.cache[require.resolve(cacheLoc)]} catch (e) {}
  if (process.env.isCmdServer) process.send(guildId);
  return callback();
}

exports.isEmptySources = function (guildId, callback) {
  // Used on the beginning of each cycle to check for empty sources per guild
  var guildRss = require(`../sources/${guildId}.json`)
  if (guildRss.sources.length === 0) {
     if (!guildRss.timezone) {
       exports.deleteFile(guildId, `../sources/${guildId}.json`, function () {
         console.log(`RSS Info: (${guildId}) => 0 sources found, deleting.`)
       });
     }
     return true;
  }
  else return false;
}

exports.readDir = function (dir, callback) {
  return fs.readdir(dir, callback)
}

exports.checkBackup = function (guildId) {
  if (config.feedManagement.enableBackups !== true) return console.log(`Guild Profile: Cannot load guild profile ${guildId}. Backups disabled, skipping profile..`);

  console.log(`Guild Profile: Cannot load guild profile ${guildId}. Backups enabled, attempting to restore backup.`);
  try {var backup = require(`../sources/backup/${guildId}`)}
  catch (e) {return console.log(`RSS Warning: Unable to restore backup for ${guildId}. Reason: ${e}`)}

  updateContent(guildId, backup, `../sources/${guildId}`);
  console.log(`Guild Profile: Successfully restored backup of ${guildId}`);
}

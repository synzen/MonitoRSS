const fs = require('fs');
const config = require('../config.json')

function updateContent(realFile, inFile, cacheFile) {
  process.send(realFile)
  fs.writeFileSync(`./sources/${realFile}.json`, JSON.stringify(inFile, null, 2))
  try {delete require.cache[require.resolve(cacheFile)]} catch (e) {}
}

exports.exists = function (file) {
  return fs.existsSync(file)
}

exports.updateFile = function (guildId, inFile, cacheFile) {
  if (fs.existsSync(`./sources/${guildId}.json`)) {
    fs.readFile(`./sources/${guildId}.json`, function (err, data) {
      if (err) throw err;
      fs.writeFileSync(`./sources/backup/${guildId}.json`, data)
      updateContent(guildId, inFile, cacheFile)
    });
  }
  else updateContent(guildId, inFile, cacheFile);
}

exports.deleteFile = function(file, cacheFile, callback) {
  fs.unlink(file, function(err) {
    if (err) return console.log(err)
    try {delete require.cache[require.resolve(cacheFile)]} catch (e) {console.log(e)}
    return callback()
  })
}

exports.readDir = function (dir, func) {
  return fs.readdir(dir, func)
}

exports.checkBackup = function (guildId) {
  if (config.enableBackups !== true) return console.log(`Guild Profile: Cannot load guild profile ${guildId}. Backups disabled, skipping profile..`);

  console.log(`Guild Profile: Cannot load guild profile ${guildId}. Backups enabled, attempting to restore backup.`);
  try {var backup = require(`../sources/backup/${guildId}`)}
  catch (e) {return console.log(`RSS Warning: Unable to restore backup for ${guildId}. Reason: ${e}`)}

  updateContent(guildId, backup, `../sources/${guildId}`);
  console.log(`Guild Profile: Successfully restored backup of ${guildId}`);
}

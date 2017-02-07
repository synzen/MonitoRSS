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
      updateContent(guildFile, inFile, cacheFile)
    });
  }
  else updateContent(guildFile, inFile, cacheFile);
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

exports.checkBackup = function (guildFile) {
  if (config.enableBackups !== true) return console.log(`Guild Profile: Cannot load guild profile ${guildFile}. Backups disabled, skipping profile..`);

  console.log(`Guild Profile: Cannot load guild profile ${guildFile}. Backups enabled, attempting to restore backup.`);
  try {var backup = require(`../sources/backup/${guildFile}`)}
  catch (e) {return console.log(`RSS Warning: Unable to restore backup for ${guildFile}. Reason: ${e}`)}

  updateContent(guildFile, backup, `../sources/${guildFile}`);
  console.log(`Guild Profile: Successfully restored backup of ${guildFile}`);
}

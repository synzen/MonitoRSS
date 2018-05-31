const fs = require('fs')
const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds
const config = require('../config.json')

function getLength (obj) {
  let len = 0
  for (var x in obj) len++
  return len
}

function updateContent (guildId, inFile, shardingManager) {
  try {
    fs.writeFileSync(`./sources/${guildId}.json`, config.advanced.minifyJSON === true ? JSON.stringify(inFile) : JSON.stringify(inFile, null, 2))
  } catch (e) { console.log(`Guild Profile Warning: Unable to update file ${guildId}.json (${e})`) }
  if (shardingManager) shardingManager.broadcast({type: 'updateGuild', guildRss: inFile})
  else if (process.send) process.send({type: 'updateGuild', guildRss: inFile}) // If this is a child process
}

exports.updateFile = function (guildId, inFile, shardingManager) { // "inFile" is the new contents in memory
  if (fs.existsSync(`./sources/${guildId}.json`)) {
    fs.readFile(`./sources/${guildId}.json`, function (err, data) {
      if (err) throw err
      if (config.feedManagement.enableBackups === true) try { fs.writeFileSync(`./sources/backup/${guildId}.json`, data) } catch (e) { console.log(`Guild Profile Warning: Unable to backup file ${guildId}.json (${e})`) }
      updateContent(guildId, inFile, shardingManager)
    })
  } else updateContent(guildId, inFile, shardingManager)
}

exports.deleteGuild = function (guildId, shardingManager, callback) {
  try {
    if (config.botSettings.persistGuildProfiles !== true) {
      fs.unlinkSync(`./sources/${guildId}.json`)
      fs.unlinkSync(`./sources/backup/${guildId}.json`)
    }
    if (typeof callback === 'function') callback()
  } catch (e) {}
  currentGuilds.delete(guildId)
  if (shardingManager) shardingManager.broadcast({type: 'deleteGuild', guildId: guildId})
  else if (process.send) process.send({type: 'deleteGuild', guildId: guildId}) // If this is a child process
}

exports.isEmptySources = function (guildRss, shardingManager) { // Used on the beginning of each cycle to check for empty sources per guild
  if (!guildRss.sources || getLength(guildRss.sources) === 0) {
    if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage) { // Delete only if server-specific special settings are not found
      exports.deleteGuild(guildRss.id, shardingManager, function () {
        console.log(`RSS Info: (${guildRss.id}) => 0 sources found with no custom settings, deleting.`)
      })
    } else console.log(`RSS Info: (${guildRss.id}) => 0 sources found, skipping.`)
    return true
  } else return false
}

exports.checkBackup = function (err, guildId) {
  if (config.feedManagement.enableRestores !== true) return console.log(`Guild Profile Warning: Cannot load guild profile ${guildId} (${err}). Restores disabled, skipping profile..`)

  console.log(`Guild Profile Warning: Cannot load guild profile ${guildId} (${err}). Restores enabled, attempting to restore backup.`)

  fs.readFile(`./sources/backup/${guildId}`, function (err, backup) {
    if (err) return console.log(`Guild Profile Warning: Unable to restore backup for ${guildId}. (${err})`)
    updateContent(guildId, backup, `../sources/${guildId}.json`)
    console.log(`Guild Profile Info: Successfully restored backup for ${guildId}`)
  })
}

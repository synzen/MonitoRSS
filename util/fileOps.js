const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds
const GuildRss = require('./storage.js').models.GuildRss()

exports.updateFile = function (guildId, contents, shardingManager) {
  GuildRss.update({ id: guildId }, contents, { overwrite: true, upsert: true, strict: true }, (err, res) => {
    if (err) console.info(`Guilds Info: Unable to update profile ${guildId}`, err.message || err)
  })
  if (shardingManager) shardingManager.broadcast({type: 'updateGuild', guildRss: contents})
  else if (process.send) process.send({type: 'updateGuild', guildRss: contents}) // If this is a child process
}

exports.deleteGuild = function (guildId, shardingManager, callback) {
  GuildRss.find({id: guildId}).remove((err, res) => {
    if (err) return console.log(`Guilds Info: Unable to delete profile ${guildId}`, err.message || err)
  })

  currentGuilds.delete(guildId)
  if (shardingManager) shardingManager.broadcast({type: 'deleteGuild', guildId: guildId})
  else if (process.send) process.send({type: 'deleteGuild', guildId: guildId}) // If this is a child process
}

exports.isEmptySources = function (guildRss, shardingManager) { // Used on the beginning of each cycle to check for empty sources per guild
  if (!guildRss.sources || Object.keys(guildRss.sources).length === 0) {
    if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage) { // Delete only if server-specific special settings are not found
      exports.deleteGuild(guildRss.id, shardingManager, function () {
        console.log(`RSS Info: (${guildRss.id}) => 0 sources found with no custom settings, deleting.`)
      })
    } else console.log(`RSS Info: (${guildRss.id}) => 0 sources found, skipping.`)
    return true
  } else return false
}

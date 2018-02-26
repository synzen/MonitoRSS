const fs = require('fs')
const Discord = require('discord.js')
const config = require('./config.json')
const storage = require('./util/storage.js')
const connectDb = require('./rss/db/connect.js')
const fileOps = require('./util/fileOps.js')
const log = require('./util/logger.js')
const dbRestore = require('./commands/controller/dbrestore.js')
const currentGuilds = storage.currentGuilds

const Manager = new Discord.ShardingManager('./server.js', { respawn: false })
const missingGuilds = {}

if (!config.advanced || typeof config.advanced.shards !== 'number' || config.advanced.shards < 1) {
  if (!config.advanced) config.advanced = {}
  config.advanced.shards = 1
  console.log('SH MANAGER: No valid shard count configured, setting default of 1')
}

const activeShardIds = []
const refreshTimes = [config.feedSettings.refreshTimeMinutes ? config.feedSettings.refreshTimeMinutes : 15] // Store the refresh times for the setIntervals of the cycles for each shard
const scheduleIntervals = [] // Array of intervals for each different refresh time
const scheduleTracker = {} // Key is refresh time, value is index for activeShardIds
let initShardIndex = 0

connectDb(err => {
  if (err) throw err
  Manager.spawn(config.advanced.shards, 0)

  Manager.shards.forEach((val, key) => activeShardIds.push(key))
  Manager.broadcast({type: 'startInit', shardId: activeShardIds[0]}) // Send the signal for first shard to initialize

  fs.readdir('./settings/schedules', (err, files) => {
    if (err) return log.init.warning('', err)
    for (var i in files) {
      fs.readFile('./settings/schedules/' + files[i], (err, data) => {
        if (err) return log.init.warning('', err)
        const refreshTime = JSON.parse(data).refreshTimeMinutes
        if (!refreshTimes.includes(refreshTime)) refreshTimes.push(refreshTime)
      })
    }
  })
})

function createIntervals () {
  refreshTimes.forEach((refreshTime, i) => {
    scheduleIntervals.push(setInterval(() => {
      scheduleTracker[refreshTime] = 0 // Key is the refresh time, value is the activeShardIds index
      let p = scheduleTracker[refreshTime]
      Manager.broadcast({type: 'runSchedule', shardId: activeShardIds[p], refreshTime: refreshTime})
    }, refreshTime * 60000))
  })
}

Manager.on('message', (shard, message) => {
  if (message === 'kill') process.exit()

  switch (message.type) {
    case 'missingGuild':
      if (!missingGuilds[message.content]) missingGuilds[message.content] = 1
      else missingGuilds[message.content]++
      break

    case 'initComplete':
      initShardIndex++
      if (initShardIndex === Manager.totalShards) {
        console.log(`SH MANAGER: All shards initialized.`)
        for (var gId in message.guilds) { // All guild profiles, with guild id as keys and guildRss as value
          currentGuilds.set(gId, message.guilds[gId])
        }
        for (var guildId in missingGuilds) {
          if (missingGuilds[guildId] === Manager.totalShards) {
            fileOps.deleteGuild(guildId, null, err => {
              if (err) return log.init.warning(`(G: ${guildId}) Guild deletion error based on missing guild`, err)
              log.init.warning(`(G: ${guildId}) Guild is missing and has been removed and backed up`)
            })
          }
        }
        createIntervals()
      } else if (initShardIndex < Manager.totalShards) Manager.broadcast({type: 'startInit', shardId: activeShardIds[initShardIndex]}) // Send signal for next shard to init
      break

    case 'scheduleComplete':
      scheduleTracker[message.refreshTime]++ // Index for activeShardIds
      if (scheduleTracker[message.refreshTime] !== Manager.totalShards) Manager.broadcast({shardId: activeShardIds[scheduleTracker[message.refreshTime]], type: 'runSchedule', refreshTime: message.refreshTime}) // Send signal for next shard to start cycle
      break

    case 'updateGuild':
      currentGuilds.set(message.guildRss.id, message.guildRss)
      Manager.broadcast({ type: 'updateGuild', guildRss: message.guildRss })
      break

    case 'deleteGuild':
      currentGuilds.delete(message.guildId)
      break

    case 'updateFailedLinks':
      Manager.broadcast(message)
      try {
        fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(message.failedLinks, null, 2))
      } catch (err) {
        log.general.warning('Sharding Manager unable to update failed links', err)
      }
      break

    case 'updateBlacklists':
    case 'updateVIPs':
      Manager.broadcast(message)
      break

    case 'dbRestore':
      scheduleIntervals.forEach(it => clearInterval(it))
      dbRestore.restoreUtil(undefined, message.fileName, message.url, message.databaseName)
      .then(() => Manager.broadcast({type: 'dbRestoreSend', channelID: message.channelID, messageID: message.messageID}))
      .catch(err => { throw err })
  }
})

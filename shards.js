const fs = require('fs')
const Discord = require('discord.js')
const config = require('./config.json')
const storage = require('./util/storage.js')
const currentGuilds = storage.currentGuilds
if (config.logging.logDates === true) require('./util/logDates.js')()

const Manager = new Discord.ShardingManager('./server.js', {respawn: false})
const missingGuilds = {}

if (!config.advanced || typeof config.advanced.shards !== 'number' || config.advanced.shards < 1) {
  if (!config.advanced) config.advanced = {}
  config.advanced.shards = 1
  console.log('SH MANAGER: No valid shard count found in config, setting default of 1')
}

Manager.spawn(config.advanced.shards, 0)

const activeShardIds = []
const refreshTimes = [config.feedSettings.refreshTimeMinutes ? config.feedSettings.refreshTimeMinutes : 15] // Store the refresh times for the setIntervals of the cycles for each shard
const scheduleIntervals = [] // Array of intervals for each different refresh time
const scheduleTracker = {} // Key is refresh time, value is index for activeShardIds

Manager.shards.forEach(function (val, key) {
  activeShardIds.push(key)
})
let initShardIndex = 0

Manager.broadcast({type: 'startInit', shardId: activeShardIds[0]}) // Send the signal for first shard to initialize

fs.readdir('./settings/schedules', function (err, files) {
  if (err) return console.log(err)
  for (var i in files) {
    fs.readFile('./settings/schedules/' + files[i], function (err, data) {
      if (err) return console.log(err)
      const refreshTime = JSON.parse(data).refreshTimeMinutes
      if (!refreshTimes.includes(refreshTime)) refreshTimes.push(refreshTime)
    })
  }
})

Manager.on('message', function (shard, message) {
  if (message === 'kill') process.exit()
  if (message.type === 'missingGuild') {
    if (!missingGuilds[message.content]) missingGuilds[message.content] = 1
    else missingGuilds[message.content]++
  } else if (message.type === 'initComplete') {
    initShardIndex++
    if (initShardIndex === Manager.totalShards) {
      console.log(`SH MANAGER: All shards initialized.`)

      for (var gId in message.guilds) { // All guild profiles, with guild id as keys and guildRss as value
        currentGuilds.set(gId, message.guilds[gId])
      }

      for (var guildId in missingGuilds) {
        if (missingGuilds[guildId] === Manager.totalShards) console.log('SH MANAGER: WARNING - Missing Guild from bot lists: ' + guildId)
      }

      for (var i in refreshTimes) {
        const refreshTime = refreshTimes[i]
        scheduleIntervals.push(setInterval(function () {
          scheduleTracker[refreshTime] = 0 // Key is the refresh time, value is the activeShardIds index
          let p = scheduleTracker[refreshTime]
          Manager.broadcast({type: 'runSchedule', shardId: activeShardIds[p], refreshTime: refreshTime})
        }, refreshTime * 60000))
      }

      try { require('./web/app.js')(null, Manager) } catch (e) {}
    } else if (initShardIndex < Manager.totalShards) Manager.broadcast({type: 'startInit', shardId: activeShardIds[initShardIndex]}) // Send signal for next shard to init
  } else if (message.type === 'scheduleComplete') {
    scheduleTracker[message.refreshTime]++ // Index for activeShardIds
    if (scheduleTracker[message.refreshTime] !== Manager.totalShards) Manager.broadcast({shardId: activeShardIds[scheduleTracker[message.refreshTime]], type: 'runSchedule', refreshTime: message.refreshTime}) // Send signal for next shard to start cycle
    // else console.log(`SH MANAGER: Cycles for all shards complete. for interval ${message.refreshTime} minutes`)
  } else if (message.type === 'updateGuild') {
    currentGuilds.set(message.guildRss.id, message.guildRss)
  } else if (message.type === 'deleteGuild') {
    currentGuilds.delete(message.guildId)
  }
})

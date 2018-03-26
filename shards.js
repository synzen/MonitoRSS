const fs = require('fs')
const Discord = require('discord.js')
const config = require('./config.json')
const storage = require('./util/storage.js')
const connectDb = require('./rss/db/connect.js')
const dbOps = require('./util/dbOps.js')
const log = require('./util/logger.js')
const dbRestore = require('./commands/controller/dbrestore.js')
const currentGuilds = storage.currentGuilds

const Manager = new Discord.ShardingManager('./server.js', { respawn: false })
const missingGuildRss = new Map()
const missingGuildsCounter = {}

if (!config.advanced || typeof config.advanced.shards !== 'number' || config.advanced.shards < 1) {
  if (!config.advanced) config.advanced = {}
  config.advanced.shards = 1
  log.general.info('No valid shard count configured, setting default of 1 for Sharding Manager.')
}

const activeShardIds = []
const refreshTimes = [config.feeds.refreshTimeMinutes ? config.feeds.refreshTimeMinutes : 15] // Store the refresh times for the setIntervals of the cycles for each shard
const scheduleIntervals = [] // Array of intervals for each different refresh time
const scheduleTracker = {} // Key is refresh time, value is index for activeShardIds
const linkList = new dbOps.LinkList()
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
    scheduleIntervals.push(setInterval(() => { // The "master interval" for a particular refresh time to determine when shards should start running their schedules
      scheduleTracker[refreshTime] = 0 // Key is the refresh time, value is the activeShardIds index
      let p = scheduleTracker[refreshTime]
      Manager.broadcast({type: 'runSchedule', shardId: activeShardIds[p], refreshTime: refreshTime})
    }, refreshTime * 60000))
  })
  setInterval(() => {
    Manager.broadcast({ type: 'cycleVIPs', shardId: activeShardIds[0] }).catch(err => log.general.error('Unable to cycle VIPs from Sharding Manager', err))
  }, 3600000)
}

Manager.on('message', async (shard, message) => {
  if (message === 'kill') process.exit()
  try {
    if (message._loopback) return await Manager.broadcast(message)
    switch (message.type) {
      case 'shardLinks':
        const docs = message.linkDocs
        for (var x = 0; x < docs.length; ++x) {
          const doc = docs[x]
          linkList.set(doc.link, doc.count, doc.shard)
        }
        break

      case 'missingGuild':
        if (!missingGuildsCounter[message.guildId]) missingGuildsCounter[message.guildId] = 1
        else missingGuildsCounter[message.guildId]++
        if (missingGuildsCounter[message.guildId] === Manager.totalShards) missingGuildRss.set(message.guildId, message.guildRss)
        break

      case 'initComplete':
        initShardIndex++
        if (initShardIndex === Manager.totalShards) {
          dbOps.linkList.write(linkList, err => {
            if (err) throw err
            Manager.broadcast({ type: 'finishedInit' })
            log.general.info(`All shards have initialized by the Sharding Manager.`)
            for (var gId in message.guilds) { // All guild profiles, with guild id as keys and guildRss as value
              currentGuilds.set(gId, message.guilds[gId])
            }
            missingGuildRss.forEach((guildRss, guildId) => {
              dbOps.guildRss.remove(guildRss, err => {
                if (err) return log.init.warning(`(G: ${guildId}) Guild deletion error based on missing guild declared by the Sharding Manager`, err)
                log.init.warning(`(G: ${guildId}) Guild is declared missing by the Sharding Manager, removing`)
              })
            })
            createIntervals()
          })
        } else if (initShardIndex < Manager.totalShards) await Manager.broadcast({type: 'startInit', shardId: activeShardIds[initShardIndex]}) // Send signal for next shard to init
        break

      case 'scheduleComplete':
        scheduleTracker[message.refreshTime]++ // Index for activeShardIds
        if (scheduleTracker[message.refreshTime] !== Manager.totalShards) {
          await Manager.broadcast({
            shardId: activeShardIds[scheduleTracker[message.refreshTime]],
            type: 'runSchedule',
            refreshTime: message.refreshTime})
        } // Send signal for next shard to start cycle
        break

      case 'dbRestore':
        scheduleIntervals.forEach(it => clearInterval(it))
        dbRestore.restoreUtil(undefined, message.fileName, message.url, message.databaseName)
        .then(() => Manager.broadcast({type: 'dbRestoreSend', channelID: message.channelID, messageID: message.messageID}))
        .catch(err => { throw err })
    }
  } catch (err) {
    log.general.error(`Sharding Manager broadcast message handling error ${JSON.stringify(message)}`, err)
  }
})

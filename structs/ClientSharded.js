const config = require('../config.json')
const storage = require('../util/storage.js')
const connectDb = require('../rss/db/connect.js')
const LinkTracker = require('./LinkTracker.js')
const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')
const dbRestore = require('../commands/controller/dbrestore.js')
const handleError = (err, message) => log.general.error(`Sharding Manager broadcast message handling error for message type ${message.type}`, err, true)

function overrideConfigs (configOverrides) {
  // Config overrides must be manually done for it to be changed in the original object (config)
  if (configOverrides) {
    for (var category in config) {
      const configCategory = config[category]
      if (!configOverrides[category]) continue
      for (var configName in configCategory) {
        if (configOverrides[category][configName]) configCategory[configName] = configOverrides[category][configName]
      }
    }
  }
}

class ClientSharded {
  constructor (shardingManager, configOverrides) {
    if (shardingManager.respawn !== false) throw new Error(`Discord.RSS requires ShardingManager's respawn option to be false`)
    overrideConfigs(configOverrides)
    this.missingGuildRss = new Map()
    this.missingGuildsCounter = {} // Object with guild IDs as keys and number as value
    this.refreshTimes = [config.feeds.refreshTimeMinutes]
    this.activeshardIds = []
    this.scheduleIntervals = [] // Array of intervals for each different refresh time
    this.scheduleTracker = {} // Key is refresh time, value is index for this.activeshardIds
    this.currentCollections = [] // Array of collection names currently in use by feeds
    this.linkTracker = new LinkTracker()
    this.shardsReady = 0 // Shards that have reported that they're ready
    this.shardsDone = 0 // Shards that have reported that they're done initializing
    this.shardingManager = shardingManager
    this.shardingManager.on('message', this.messageHandler.bind(this))
    connectDb().then(() => {
      if (shardingManager.shards.size === 0) shardingManager.spawn(config.advanced.shards, 0) // They may have already been spawned with a predefined ShardingManager
      shardingManager.shards.forEach((val, key) => this.activeshardIds.push(key))
    }).catch(err => log.general.error(`ClientSharded db connection`, err))
  }

  messageHandler (shard, message) {
    if (!message._drss) return
    if (message._loopback) return this.shardingManager.broadcast(message).catch(err => handleError(err, message))
    switch (message.type) {
      case 'kill': process.exit(0)
      case 'customSchedules': this._customSchedulesEvent(message); break
      case 'shardReady': this._shardReadyEvent(message); break
      case 'initComplete': this._initCompleteEvent(message); break
      case 'scheduleComplete': this._scheduleCompleteEvent(message); break
      case 'addCustomSchedule': this._addCustomSchedule(message); break
      case 'dbRestore': this._dbRestoreEvent(message)
    }
  }

  _customSchedulesEvent (message) {
    message.customSchedules.forEach(schedule => this.refreshTimes.push(schedule.refreshTimeMinutes))
  }

  _shardReadyEvent (message) {
    if (++this.shardsReady === this.shardingManager.totalShards) this.shardingManager.broadcast({ _drss: true, type: 'startInit', shardId: this.activeshardIds[0] }) // Send the signal for first shard to initialize
  }
  _initCompleteEvent (message) {
    // Account for missing guilds
    const missing = message.missingGuilds
    for (var guildId in missing) {
      if (!this.missingGuildsCounter[guildId]) this.missingGuildsCounter[guildId] = 1
      else this.missingGuildsCounter[guildId]++
      if (this.missingGuildsCounter[guildId] === this.shardingManager.totalShards) this.missingGuildRss.set(guildId, missing[guildId])
    }

    // Count all the links
    const linkDocs = message.linkDocs
    for (var x = 0; x < linkDocs.length; ++x) {
      const doc = linkDocs[x]
      this.linkTracker.set(doc.link, doc.count, doc.shard)
      const id = storage.collectionId(doc.link, doc.shard)
      if (!this.currentCollections.includes(id)) this.currentCollections.push(id) // To find out any unused collections eligible for removal
    }

    if (++this.shardsDone === this.shardingManager.totalShards) {
      // Drop the ones not in the current collections
      dbOps.general.cleanDatabase(this.currentCollections).catch(err => log.general.error(`Unable to clean database`, err))

      dbOps.linkTracker.write(this.linkTracker)
        .then(() => {
          this.shardingManager.broadcast({ _drss: true, type: 'finishedInit' })
          log.general.info(`All shards have initialized by the Sharding Manager.`)
          this.missingGuildRss.forEach((guildRss, guildId) => {
            dbOps.guildRss.remove(guildRss)
              .then(() => log.init.warning(`(G: ${guildId}) Guild is declared missing by the Sharding Manager, removing`))
              .catch(err => log.init.warning(`(G: ${guildId}) Guild deletion error based on missing guild declared by the Sharding Manager`, err))
          })
          this.createIntervals()
        })
        .catch(err => {
          console.log(err)
          process.exit(1)
        })
    } else if (this.shardsDone < this.shardingManager.totalShards) {
      this.shardingManager.broadcast({ _drss: true, type: 'startInit', shardId: this.activeshardIds[this.shardsDone] }).catch(err => handleError(err, message)) // Send signal for next shard to init
    }
  }

  _scheduleCompleteEvent (message) {
    this.scheduleTracker[message.refreshTime]++ // Index for this.activeshardIds
    if (this.scheduleTracker[message.refreshTime] !== this.shardingManager.totalShards) {
      // Send signal for next shard to start cycle
      const broadcast = {
        _drss: true,
        shardId: this.activeshardIds[this.scheduleTracker[message.refreshTime]],
        type: 'runSchedule',
        refreshTime: message.refreshTime
      }
      this.shardingManager.broadcast(broadcast).catch(err => handleError(err, message))
    }
  }

  _addCustomSchedule (message) {
    const refreshTime = message.schedule.refreshTimeMinutes
    if (this.refreshTimes.includes(refreshTime)) return
    this.refreshTimes.push(refreshTime)
    if (this.shardsDone < this.shardingManager.totalShards) return // In this case, the method createIntervals that will create the interval, so avoid creating it here
    this.scheduleIntervals.push(setInterval(() => {
      this.scheduleTracker[refreshTime] = 0
      const p = this.scheduleTracker[refreshTime]
      const broadcast = { _drss: true, type: 'runSchedule', shardId: this.activeshardIds[p], refreshTime: refreshTime }
      this.shardingManager.broadcast(broadcast)
    }, refreshTime * 60000)) // Convert minutes to ms
  }

  _dbRestoreEvent (message) {
    this.scheduleIntervals.forEach(it => clearInterval(it))
    this.shardingManager.broadcast({ _drss: true, type: 'stop' })
    dbRestore.restoreUtil(null, err => {
      if (err) throw err
      this.shardingManager.broadcast({ _drss: true, type: 'dbRestoreSend', channelID: message.channelID, messageID: message.messageID })
    })
  }

  createIntervals () {
    this.refreshTimes.forEach((refreshTime, i) => {
      // The "master interval" for a particular refresh time to determine when shards should start running their schedules
      this.scheduleIntervals.push(setInterval(() => {
        this.scheduleTracker[refreshTime] = 0 // Key is the refresh time, value is the this.activeshardIds index. Set at 0 to start at the first index. Later indexes are handled by the 'scheduleComplete' message
        const p = this.scheduleTracker[refreshTime]
        const broadcast = { _drss: true, type: 'runSchedule', shardId: this.activeshardIds[p], refreshTime: refreshTime }
        this.shardingManager.broadcast(broadcast)
      }, refreshTime * 60000)) // Convert minutes to ms
    })
    // Refresh VIPs on a schedule
    setInterval(() => {
      // Only needs to be run on a single shard since dbOps uniformizes it across all shards
      this.shardingManager.broadcast({ _drss: true, type: 'cycleVIPs', shardId: this.activeshardIds[0] }).catch(err => log.general.error('Unable to cycle VIPs from Sharding Manager', err))
    }, 900000)
  }
}

module.exports = ClientSharded

const fs = require('fs')
const path = require('path')
const config = require('../config.js')
const storage = require('../util/storage.js')
const connectDb = require('../rss/db/connect.js')
const LinkTracker = require('./LinkTracker.js')
const dbOps = require('../util/dbOps.js')
const redisOps = require('../util/redisOps.js')
const log = require('../util/logger.js')
const dbRestore = require('../commands/controller/dbrestore.js')
const EventEmitter = require('events')

function overrideConfigs (configOverrides) {
  // Config overrides must be manually done for it to be changed in the original object (config)
  for (var category in config) {
    const configCategory = config[category]
    if (!configOverrides[category]) continue
    for (var configName in configCategory) {
      if (configOverrides[category][configName] !== undefined && configOverrides[category][configName] !== config[category][configName]) {
        log.controller.info(`Overriding config.${category}.${configName} from ${JSON.stringify(config[category][configName])} to ${JSON.stringify(configOverrides[category][configName])} from configOverride.json`)
        configCategory[configName] = configOverrides[category][configName]
      }
    }
  }
}

class ClientManager extends EventEmitter {
  constructor (shardingManager, configOverrides) {
    super()
    if (shardingManager.respawn !== false) throw new Error(`Discord.RSS requires ShardingManager's respawn option to be false`)
    try {
      const fileConfigOverride = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'settings', 'configOverride.json')))
      overrideConfigs(fileConfigOverride)
      overrideConfigs(configOverrides)
    } catch (err) {
      overrideConfigs(configOverrides)
    }
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
    this.vipApiData = null
  }

  async run () {
    try {
      if (config._vip && !this.vipApiData) this.vipApiData = await require('../settings/api.js')()
      await connectDb()
      await redisOps.flushDatabase()
      if (this.shardingManager.shards.size === 0) this.shardingManager.spawn(config.advanced.shards) // They may have already been spawned with a predefined ShardingManager
    } catch (err) {
      log.general.error(`ClientManager db connection`, err)
    }
  }

  messageHandler (shard, message) {
    if (!message._drss) return
    if (message._loopback) return this.shardingManager.broadcast(message).catch(err => this._handleErr(err, message))
    switch (message.type) {
      case 'kill': this.kill(); break
      case 'spawned': this._spawnedEvent(message); break
      case 'shardReady': this._shardReadyEvent(shard, message); break
      case 'initComplete': this._initCompleteEvent(message); break
      case 'scheduleComplete': this._scheduleCompleteEvent(message); break
      case 'addCustomSchedule': this._addCustomScheduleEvent(message); break
      case 'dbRestore': this._dbRestoreEvent(message)
    }
  }

  kill () {
    this.shardingManager.broadcast({ _drss: true, type: 'kill' })
    process.exit(0)
  }

  _handleErr (err, message) {
    log.general.error(`Sharding Manager broadcast message handling error for message type ${message.type}`, err, true)
    this.kill()
  }

  _spawnedEvent (message) {
    this.activeshardIds.push(message.shardId)
    if (message.customSchedules) message.customSchedules.forEach(schedule => this.refreshTimes.push(schedule.refreshTimeMinutes))
  }

  async _shardReadyEvent (shard, message) {
    this.shardingManager.broadcast({ _drss: true, type: 'startInit', shardId: shard.id, vipApiData: this.vipApiData }) // Send the signal for first shard to initialize
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
      this.linkTracker.set(doc.link, doc.count, doc.shard, doc.scheduleName)
      const id = storage.collectionId(doc.link, doc.shard, doc.scheduleName)
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
          this.emit('finishInit')
        })
        .catch(err => {
          console.log(err)
          process.exit(1)
        })
    } else if (this.shardsDone < this.shardingManager.totalShards) {
      this.shardingManager.broadcast({ _drss: true, type: 'startInit', shardId: this.activeshardIds[this.shardsDone], vipServers: message.vipServers, vipApiData: this.vipApiData }).catch(err => this._handleErr(err, message)) // Send signal for next shard to init
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
      this.shardingManager.broadcast(broadcast).catch(err => this._handleErr(err, message))
    }
  }

  _addCustomScheduleEvent (message) {
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
    const initiateCycles = refreshTime => () => {
      let p
      for (p = 0; p < config.advanced.parallelShards && p < this.activeshardIds.length; ++p) {
        this.scheduleTracker[refreshTime] = p // Key is the refresh time, value is the this.activeshardIds index. Set at 0 to start at the first index. Later indexes are handled by the 'scheduleComplete' message
        this.shardingManager.broadcast({ _drss: true, type: 'runSchedule', shardId: this.activeshardIds[p], refreshTime: refreshTime })
      }
    }

    // The "master interval" for a particular refresh time to determine when shards should start running their schedules
    this.refreshTimes.forEach((refreshTime, i) => this.scheduleIntervals.push(setInterval(initiateCycles(refreshTime).bind(this), refreshTime * 60000))) // Convert minutes to ms
    initiateCycles(config.feeds.refreshTimeMinutes)() // Immediately start the default retrieval cycles

    // Refresh VIPs on a schedule
    setInterval(() => {
      // Only needs to be run on a single shard since dbOps uniformizes it across all shards
      this.shardingManager.broadcast({ _drss: true, type: 'cycleVIPs', shardId: this.activeshardIds[0] }).catch(err => log.general.error('Unable to cycle VIPs from Sharding Manager', err))
    }, 900000)
    this.shardingManager.broadcast({ _drss: true, type: 'cycleVIPs', shardId: this.activeshardIds[0], vipApiData: this.vipApiData }).catch(err => log.general.error('Unable to cycle VIPs from Sharding Manager', err)) // Manually run this to update the names
    this.vipApiData = null
  }
}

module.exports = ClientManager

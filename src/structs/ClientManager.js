process.env.DRSS = true
const config = require('../config.js')
const connectDb = require('../rss/db/connect.js')
const dbOpsGeneral = require('../util/db/general.js')
const dbOpsVips = require('../util/db/vips.js')
const ScheduleManager = require('./ScheduleManager.js')
const FeedScheduler = require('../util/FeedScheduler.js')
const redisIndex = require('../structs/db/Redis/index.js')
const log = require('../util/logger.js')
const dbRestore = require('../commands/owner/dbrestore.js')
const EventEmitter = require('events')
const ArticleModel = require('../models/Article.js')
const AssignedSchedule = require('../structs/db/AssignedSchedule.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Feed = require('../structs/db/Feed.js')
let webClient

class ClientManager extends EventEmitter {
  constructor (shardingManager, settings) {
    super()
    if (shardingManager.respawn !== false) {
      throw new Error(`Discord.RSS requires ShardingManager's respawn option to be false`)
    }
    if (settings.config) {
      config._overrideWith(settings.config)
    }
    if (config.web.enabled === true) {
      webClient = require('../web/index.js')
    }
    this.brokenGuilds = []
    this.brokenFeeds = []
    this.danglingGuildsCounter = {} // Object with guild IDs as keys and number as value
    this.danglingFeedsCounter = {}
    this.refreshRates = []
    this.activeshardIds = []
    this.scheduleIntervals = [] // Array of intervals for each different refresh time
    this.scheduleTracker = {} // Key is refresh time, value is index for this.activeshardIds
    this.currentCollections = new Set() // Set of collection names currently in use by feeds
    this.shardsReady = 0 // Shards that have reported that they're ready
    this.shardsDone = 0 // Shards that have reported that they're done initializing
    this.shardingManager = shardingManager
    this.shardingManager.on('message', this.messageHandler.bind(this))
    this.webClientInstance = undefined
  }

  async run () {
    try {
      await connectDb()
      await ScheduleManager.initializeSchedules()
      if (config.web.enabled === true && !this.webClientInstance) {
        this.webClientInstance = webClient()
      }
      await dbOpsGeneral.verifyFeedIDs()
      await redisIndex.flushDatabase()
      await AssignedSchedule.deleteAll()
      if (this.shardingManager.shards.size === 0) {
        this.shardingManager.spawn(config.advanced.shards) // They may have already been spawned with a predefined ShardingManager
      }
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
    if (message.customSchedules) message.customSchedules.forEach(schedule => this.refreshRates.push(schedule.refreshRateMinutes))
  }

  async _shardReadyEvent (shard, message) {
    await FeedScheduler.assignSchedules(shard.id, message.guildIds, await dbOpsVips.getValidServers())
    this.shardingManager.broadcast({ _drss: true, type: 'startInit', shardId: shard.id }) // Send the signal for first shard to initialize
  }

  _initCompleteEvent (message) {
    // Account for missing guilds
    let { danglingGuilds, danglingFeeds } = message
    for (const guildId of danglingGuilds) {
      if (!this.danglingGuildsCounter[guildId]) {
        this.danglingGuildsCounter[guildId] = 1
      } else {
        this.danglingGuildsCounter[guildId]++
      }
      if (this.danglingGuildsCounter[guildId] === this.shardingManager.totalShards) {
        this.brokenGuilds.push(guildId)
      }
    }

    for (const feedId of danglingFeeds) {
      if (!this.danglingFeedsCounter[feedId]) {
        this.danglingFeedsCounter[feedId] = 1
      } else {
        this.danglingFeedsCounter[feedId]++
      }
      if (this.danglingFeedsCounter[feedId] === this.shardingManager.totalShards) {
        this.brokenFeeds.push(feedId)
      }
    }

    // Count all the links
    const activeLinks = message.activeLinks
    for (const item of activeLinks) {
      const id = ArticleModel.getCollectionID(item.url, item.shard, item.scheduleName)
      this.currentCollections.add(id) // To find out any unused collections eligible for removal
    }

    if (++this.shardsDone === this.shardingManager.totalShards) {
      // Drop the ones not in the current collections
      dbOpsGeneral.cleanDatabase(this.currentCollections).catch(err => log.general.error(`Unable to clean database`, err))
      this.shardingManager.broadcast({ _drss: true, type: 'finishedInit' })
      log.general.info(`All shards have initialized by the Sharding Manager.`)
      this.brokenGuilds.forEach(guildId => {
        log.init.warning(`(G: ${guildId}) Guild is declared missing by the Sharding Manager, removing`)
        GuildProfile.get(guildId)
          .then(profile => profile ? profile.delete() : null)
          .catch(err => log.init.warning(`(G: ${guildId}) Guild deletion error based on missing guild declared by the Sharding Manager`, err))
      })
      this.brokenFeeds.forEach(feedId => {
        log.init.warning(`(F: ${feedId}) Feed is declared missing by the Sharding Manager, removing`)
        Feed.get(feedId)
          .then(feed => feed ? feed.delete() : null)
          .catch(err => log.init.warning(`(F: ${feedId}) Feed deletion error based on missing guild declared by the Sharding Manager`, err))
      })
      this.createIntervals()
      if (config.web.enabled === true) this.webClientInstance.enableCP()
      this.emit('finishInit')
    } else if (this.shardsDone < this.shardingManager.totalShards) {
      this.shardingManager.broadcast({ _drss: true, type: 'startInit', shardId: this.activeshardIds[this.shardsDone], vipServers: message.vipServers }).catch(err => this._handleErr(err, message)) // Send signal for next shard to init
    }
  }

  _scheduleCompleteEvent (message) {
    const { refreshRate } = message
    this.scheduleTracker[refreshRate]++ // Index for this.activeshardIds
    if (this.scheduleTracker[refreshRate] !== this.shardingManager.totalShards) {
      // Send signal for next shard to start cycle
      const broadcast = {
        _drss: true,
        shardId: this.activeshardIds[this.scheduleTracker[refreshRate]],
        type: 'runSchedule',
        refreshRate
      }
      this.shardingManager.broadcast(broadcast).catch(err => this._handleErr(err, message))
    }
  }

  _addCustomScheduleEvent (message) {
    const refreshRate = message.schedule.refreshRateMinutes
    if (this.refreshRates.includes(refreshRate)) return
    this.refreshRates.push(refreshRate)
    if (this.shardsDone < this.shardingManager.totalShards) return // In this case, the method createIntervals that will create the interval, so avoid creating it here
    this.scheduleIntervals.push(setInterval(() => {
      this.scheduleTracker[refreshRate] = 0
      const p = this.scheduleTracker[refreshRate]
      const broadcast = { _drss: true, type: 'runSchedule', shardId: this.activeshardIds[p], refreshRate: refreshRate }
      this.shardingManager.broadcast(broadcast)
    }, refreshRate * 60000)) // Convert minutes to ms
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
    const initiateCycles = refreshRate => () => {
      let p
      for (p = 0; p < config.advanced.parallelShards && p < this.activeshardIds.length; ++p) {
        this.scheduleTracker[refreshRate] = p // Key is the refresh time, value is the this.activeshardIds index. Set at 0 to start at the first index. Later indexes are handled by the 'scheduleComplete' message
        this.shardingManager.broadcast({ _drss: true, type: 'runSchedule', shardId: this.activeshardIds[p], refreshRate })
      }
    }

    // The "master interval" for a particular refresh time to determine when shards should start running their schedules
    this.refreshRates.forEach((refreshRate, i) => {
      this.scheduleIntervals.push(setInterval(initiateCycles(refreshRate).bind(this), refreshRate * 60000))
    })
    initiateCycles(config.feeds.refreshRateMinutes)() // Immediately start the default retrieval cycles with the specified refresh rate

    // Refresh VIPs on a schedule
    setInterval(() => {
      // Only needs to be run on a single shard since dbOps uniformizes it across all shards
      this.shardingManager.broadcast({ _drss: true, type: 'cycleVIPs', shardId: this.activeshardIds[0] }).catch(err => log.general.error('Unable to cycle VIPs from Sharding Manager', err))
    }, 900000)
    // this.shardingManager.broadcast({ _drss: true, type: 'cycleVIPs', shardId: this.activeshardIds[0] }).catch(err => log.general.error('Unable to cycle VIPs from Sharding Manager', err)) // Manually run this to update the names
  }
}

module.exports = ClientManager

process.env.DRSS = true
const config = require('../config.js')
const connectDb = require('../rss/db/connect.js')
const Patron = require('./db/Patron.js')
const log = require('../util/logger.js')
const EventEmitter = require('events')
const maintenance = require('../util/maintenance/index.js')
const initialize = require('../util/initialization.js')
let webClient

class ClientManager extends EventEmitter {
  constructor (shardingManager, settings, customSchedules = []) {
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
    this.maintenance = maintenance.cycle()
    this.customSchedules = customSchedules
    this.guildIdsByShard = new Map()
    this.refreshRates = new Set()
    this.activeshardIds = []
    this.scheduleIntervals = [] // Array of intervals for each different refresh time
    this.scheduleTracker = {} // Key is refresh time, value is index for this.activeshardIds
    this.shardsReady = 0 // Shards that have reported that they're ready
    this.shardsDone = 0 // Shards that have reported that they're done initializing
    this.shardingManager = shardingManager
    this.shardingManager.on('message', this.messageHandler.bind(this))
    this.webClientInstance = undefined
  }

  async run () {
    try {
      await connectDb()
      const schedules = await initialize.populateSchedules(this.customSchedules)
      schedules.forEach(schedule => this.refreshRates.add(schedule.refreshRateMinutes))
      if (config.web.enabled === true && !this.webClientInstance) {
        this.webClientInstance = webClient()
      }
      if (this.shardingManager.shards.size === 0) {
        // They may have already been spawned with a predefined ShardingManager
        this.shardingManager.spawn(config.advanced.shards)
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
      case 'shardReady': this._shardReadyEvent(shard, message); break
      case 'initComplete': this._initCompleteEvent(message); break
      case 'scheduleComplete': this._scheduleCompleteEvent(message); break
      case 'addCustomSchedule': this._addCustomScheduleEvent(message); break
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

  _shardReadyEvent (shard, message) {
    const totalShards = this.shardingManager.totalShards
    this.activeshardIds.push(shard.id)
    message.guildIds.forEach(id => {
      this.guildIdsByShard.set(id, shard.id)
    })
    // this.guildIdsByShard.set(shard.id, message.guildIds)
    if (++this.shardsReady < totalShards) {
      return
    }
    maintenance.prunePreInit(this.guildIdsByShard)
      .then(() => {
        this.shardingManager.broadcast({
          _drss: true,
          type: 'startInit',
          customSchedules: this.customSchedules || []
        })
      }).catch(err => {
        log.general.error('Failed to execute prune pre init in sharding manager', err)
      })
  }

  _initCompleteEvent (message) {
    // Count all the links
    if (++this.shardsDone === this.shardingManager.totalShards) {
      log.general.info(`All shards have initialized by the Sharding Manager.`)
      maintenance.prunePostInit(this.guildIdsByShard)
        .then(() => Patron.refresh())
        .then(() => {
          // Create feed schedule intervals
          this.createIntervals()
          // Start the web UI
          if (config.web.enabled === true) {
            this.webClientInstance.enableCP()
          }
          this.shardingManager.broadcast({
            _drss: true,
            type: 'finishedInit'
          })
          this.emit('finishInit')
        })
        .catch(err => {
          log.general.error(`Post-initialization failed in sharding manager`, err, true)
        })
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

  createIntervals () {
    const initiateCycles = refreshRate => () => {
      let p
      for (p = 0; p < config.advanced.parallelShards && p < this.activeshardIds.length; ++p) {
        this.scheduleTracker[refreshRate] = p // Key is the refresh time, value is the this.activeshardIds index. Set at 0 to start at the first index. Later indexes are handled by the 'scheduleComplete' message
        this.shardingManager.broadcast({ _drss: true, type: 'runSchedule', shardId: this.activeshardIds[p], refreshRate })
      }
    }

    // The "master interval" for a particular refresh time to determine when shards should start running their schedules
    this.refreshRates.forEach(refreshRate => {
      this.scheduleIntervals.push(setInterval(initiateCycles(refreshRate).bind(this), refreshRate * 60000))
    })
    // Immediately start the default retrieval cycles with the specified refresh rate
    initiateCycles(config.feeds.refreshRateMinutes)()
  }
}

module.exports = ClientManager

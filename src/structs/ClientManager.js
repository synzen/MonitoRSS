process.env.DRSS = true
const Discord = require('discord.js')
const config = require('../config.js')
const connectDb = require('../util/connectDatabase.js')
const Patron = require('./db/Patron.js')
const Supporter = require('./db/Supporter.js')
const ScheduleManager = require('./ScheduleManager.js')
const EventEmitter = require('events').EventEmitter
const maintenance = require('../maintenance/index.js')
const initialize = require('../util/initialization.js')
const createLogger = require('../util/logger/create.js')
const ipc = require('../util/ipc.js')

/**
 * @typedef {Object} ClientManagerOptions
 * @property {Object<string, Object<string, any>>} schedules
 * @property {boolean} setPresence
 * @property {string} logFile
 */

class ClientManager extends EventEmitter {
  /**
   * @param {ClientManagerOptions} options
   */
  constructor (options) {
    super()
    if (options && options.logFile && typeof options.logFile === 'string') {
      process.env.DRSS_LOG_DESTINATION = options.logFile
    }
    this.log = createLogger('M')
    this.setPresence = options ? options.setPresence : false
    this.customSchedules = options ? options.schedules : {}
    ClientManager.validateCustomSchedules(this.customSchedules)
    this.maintenance = maintenance.cycle()
    this.guildIdsByShard = new Map()
    this.channelIdsByShard = new Map()
    this.activeshardIds = []
    this.scheduleIntervals = [] // Array of intervals for each different refresh time
    this.scheduleTracker = {} // Key is refresh time, value is index for this.activeshardIds
    this.shardsReady = 0 // Shards that have reported that they're ready
    this.shardsDone = 0 // Shards that have reported that they're done initializing
    this.scheduleManager = new ScheduleManager()
    this.scheduleManager.on('article', article => {
      this.broadcastArticle(article)
    })
    this.shardingManager = new Discord.ShardingManager('./server-shard.js', { respawn: false })
    this.shardingManager.on('shardCreate', shard => {
      shard.on('message', message => this.messageHandler(shard, message))
    })
  }

  broadcast (type, data) {
    this.shardingManager.broadcast({
      _drss: true,
      type,
      data
    })
  }

  broadcastArticle (article) {
    this.broadcast(ipc.TYPES.NEW_ARTICLE, article)
  }

  static validateCustomSchedules (customSchedules) {
    const addedRates = new Set()
    addedRates.add(config.feeds.refreshRateMinutes)
    for (const name in customSchedules) {
      const schedule = customSchedules[name]
      if (name === 'example') {
        continue
      }
      if (addedRates.has(schedule.refreshRateMinutes)) {
        throw new Error('Duplicate schedule refresh rates are not allowed')
      }
      addedRates.add(schedule.refreshRateMinutes)
    }
  }

  async run (shardCount = config.advanced.shards) {
    try {
      await connectDb('M')
      const schedules = await initialize.populateSchedules(this.customSchedules)
      this.scheduleManager.addSchedules(schedules)
      if (config.web.enabled === true) {
        require('../web/index.js')()
      }
      this.shardingManager.spawn(shardCount, 5500, -1)
    } catch (err) {
      this.log.error(err, `ClientManager db connection`)
    }
  }

  messageHandler (shard, message) {
    if (!ipc.isValid(message)) {
      return
    }
    if (ipc.isLoopback(message)) {
      return this.shardingManager.broadcast(message)
        .catch(err => this._handleErr(err, message))
    }
    switch (message.type) {
      case ipc.TYPES.KILL: this.kill(); break
      case ipc.TYPES.SHARD_READY: this._shardReadyEvent(shard, message); break
      case ipc.TYPES.INIT_COMPLETE: this._initCompleteEvent(); break
    }
  }

  kill () {
    this.shardingManager.shards.forEach(shard => {
      shard.kill()
    })
    process.exit(0)
  }

  _handleErr (err, message) {
    this.log.error(err, `Sharding Manager broadcast message handling error for message type ${message.type}`)
    this.kill()
  }

  async _shardReadyEvent (shard, message) {
    const totalShards = this.shardingManager.totalShards
    this.activeshardIds.push(shard.id)
    message.data.guildIds.forEach(id => {
      this.guildIdsByShard.set(id, shard.id)
    })
    message.data.channelIds.forEach(id => {
      this.channelIdsByShard.set(id, shard.id)
    })
    if (++this.shardsReady < totalShards) {
      return
    }
    try {
      await maintenance.prunePreInit(this.guildIdsByShard, this.channelIdsByShard)
      const data = {
        setPresence: this.setPresence || false,
        customSchedules: this.customSchedules || []
      }
      this.broadcast(ipc.TYPES.START_INIT, data)
    } catch (err) {
      this.log.fatal(err, 'Failed to execute prune pre init in sharding manager')
    }
  }

  async _initCompleteEvent () {
    // Count all the links
    if (++this.shardsDone < this.shardingManager.totalShards) {
      return
    }
    try {
      this.log.info(`All shards have initialized by the Sharding Manager.`)
      await maintenance.prunePostInit(this.guildIdsByShard)
      if (Supporter.enabled) {
        await Patron.refresh()
      }
      this.scheduleManager.beginTimers()
      this.broadcast(ipc.TYPES.FINISHED_INIT)
      this.emit('finishInit')
    } catch (err) {
      this.log.fatal(err, `Post-initialization failed in sharding manager`)
    }
  }
}

module.exports = ClientManager

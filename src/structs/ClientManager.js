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
    this.log = createLogger('M')
    this.setPresence = options ? options.setPresence : false
    this.customSchedules = options ? options.schedules : {}
    ClientManager.validateCustomSchedules(this.customSchedules)
    this.maintenance = maintenance.cycle()
    this.guildIdsByShard = new Map()
    this.channelIdsByShard = new Map()
    this.queuedArticles = new Map() // Articles that are not sent due to Clients with stop status
    this.shardsReady = 0 // Shards that have reported that they're ready
    this.shardsDone = 0 // Shards that have reported that they're done initializing
    this.shardsStopped = new Set()
    this.scheduleManager = new ScheduleManager()
    this.scheduleManager.on('article', article => {
      this.log.debug(`ScheduleManager emitted article ${article._id}`)
      this.handleNewArticle(article)
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

  send (type, data, shard) {
    shard.send({
      _drss: true,
      type,
      data
    })
  }

  broadcastArticle (article) {
    const feed = article._feed
    const debug = this.scheduleManager.isDebugging(feed._id)
    this.broadcast(ipc.TYPES.NEW_ARTICLE, {
      debug,
      article
    })
  }

  sendArticle (article, shard) {
    const feed = article._feed
    const debug = this.scheduleManager.isDebugging(feed._id)
    this.send(ipc.TYPES.NEW_ARTICLE, {
      debug,
      article
    }, shard)
  }

  handleNewArticle (article) {
    const feed = article._feed
    this.log.debug(`Got new feed $${feed._id} article ${article._id}`)
    if (this.shardsStopped.size > 0) {
      this.shardingManager.shards.forEach(shard => {
        const shardID = shard.id
        if (this.shardsStopped.has(shardID)) {
          this.log.debug(`Queueing feed ${feed._id} article ${article._id} for shard ${shardID} with some stopped shards`)
          this.queuedArticles.get(shardID).push(article)
        } else {
          this.log.debug(`Sending feed ${feed._id} article ${article._id} for shard ${shardID} with some stopped shards`)
          this.sendArticle(article, shard)
        }
      })
    } else {
      this.log.debug(`Broadcasting feed ${feed._id} article ${article._id}`)
      this.broadcastArticle(article)
    }
  }

  sendQueuedArticles (shard) {
    this.log.debug(`About to send queued articles for ${shard.id}`)
    /** @type {Object<string, any>[]} */
    const queue = this.queuedArticles.get(shard.id)
    const length = queue.length
    for (var i = 0; i < length; ++i) {
      const article = queue[i]
      this.log.debug(`Sending queued article ${article._id} to shard ${shard.id}`)
      this.sendArticle(article, shard)
    }
    queue.length = 0
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
      if (config.web.enabled === true && config.database.redis && Supporter.isMongoDatabase) {
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
      case ipc.TYPES.INIT_COMPLETE: this._initCompleteEvent(shard); break
      case ipc.TYPES.SHARD_STOPPED: this._shardStoppedEvent(shard); break
      case ipc.TYPES.ADD_DEBUG_FEEDID: this._addDebugFeedIDEvent(message.data); break
      case ipc.TYPES.REMOVE_DEBUG_FEEDID: this._removeDebugFeedIDEvent(message.data); break
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
    this.log.debug(`Shard ${shard.id} is ready`)
    this.shardsStopped.delete(shard.id)
    message.data.guildIds.forEach(id => {
      this.guildIdsByShard.set(id, shard.id)
    })
    message.data.channelIds.forEach(id => {
      this.channelIdsByShard.set(id, shard.id)
    })
    if (++this.shardsReady < this.shardingManager.totalShards) {
      return
    }
    // Only after all shards are ready do we broadcast start init
    try {
      await maintenance.prunePreInit(this.guildIdsByShard, this.channelIdsByShard)
      const data = {
        setPresence: this.setPresence || false,
        customSchedules: this.customSchedules || []
      }
      if (this.shardsReady === this.shardingManager.totalShards) {
        this.broadcast(ipc.TYPES.START_INIT, data)
      }
    } catch (err) {
      this.log.fatal(err, 'Failed to execute prune pre init in sharding manager')
    }
  }

  async _initCompleteEvent (shard) {
    if (!this.queuedArticles.has(shard.id)) {
      this.queuedArticles.set(shard.id, [])
    }
    if (++this.shardsDone < this.shardingManager.totalShards) {
      return
    }
    try {
      this.log.info(`All shards have initialized by the Sharding Manager.`)
      this.sendQueuedArticles(shard)
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

  _shardStoppedEvent (shard) {
    this.log.debug(`Added shard ${shard.id} to shards stopped`)
    this.shardsStopped.add(shard.id)
  }

  _addDebugFeedIDEvent (feedID) {
    this.log.info(`Adding ${feedID} to schedule manager debug`)
    this.scheduleManager.addDebugFeedID(feedID)
  }

  _removeDebugFeedIDEvent (feedID) {
    this.log.info(`Removing ${feedID} to schedule manager debug`)
    this.scheduleManager.removeDebugFeedID(feedID)
  }
}

module.exports = ClientManager

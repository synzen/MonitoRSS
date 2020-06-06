process.env.DRSS = true
const path = require('path')
const Discord = require('discord.js')
const connectDb = require('../util/connectDatabase.js')
const Patron = require('./db/Patron.js')
const Supporter = require('./db/Supporter.js')
const ScheduleManager = require('./ScheduleManager.js')
const EventEmitter = require('events').EventEmitter
const maintenance = require('../maintenance/index.js')
const initialize = require('../initialization/index.js')
const createLogger = require('../util/logger/create.js')
const ipc = require('../util/ipc.js')
const configuration = require('../config.js')
const setConfig = configuration.set
const getConfig = configuration.get
const devLevels = require('../util/devLevels.js')
const dumpHeap = require('../util/dumpHeap.js')

/**
 * @typedef {Object} ClientManagerOptions
 * @property {Object<string, Object<string, any>>} schedules
 * @property {boolean} setPresence
 * @property {string} config
 */

class ClientManager extends EventEmitter {
  /**
   * @param {ClientManagerOptions} options
   */
  constructor (options = {}) {
    super()
    const nodeMajorVersion = Number(process.version.split('.')[0].replace('v', ''))
    if (nodeMajorVersion < 12) {
      throw new Error('Discord.RSS requires Node.js v12 or higher')
    }
    this.config = setConfig(options.config)
    process.env.DRSS_CONFIG = JSON.stringify(this.config)
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
    this.scheduleManager = this.createScheduleManager()
    this.shardingManager = new Discord.ShardingManager(path.join(__dirname, '..', '..', 'shard.js'), {
      respawn: false,
      token: this.config.bot.token
    })
    this.shardingManager.on('shardCreate', shard => {
      shard.on('message', message => this.messageHandler(shard, message))
    })
  }

  setupHeapDumps () {
    // Every 10 minutes
    const prefix = 'sm'
    dumpHeap(prefix)
    setInterval(() => {
      dumpHeap(prefix)
    }, 1000 * 60 * 15)
  }

  createScheduleManager () {
    const scheduleManager = new ScheduleManager()
    scheduleManager.on('newArticle', newArticle => {
      const { article } = newArticle
      this.log.debug({
        newArticle
      }, `ScheduleManager emitted new article article id ${article._id}`)
      this.handleNewArticle(newArticle)
    })
    scheduleManager.on('alert', (channelID, message) => {
      this.broadcastUserAlert(channelID, message)
    })
    return scheduleManager
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

  broadcastNewArticle (newArticle) {
    const { feedObject } = newArticle
    const debug = this.scheduleManager.isDebugging(feedObject._id)
    this.broadcast(ipc.TYPES.NEW_ARTICLE, {
      debug,
      newArticle
    })
  }

  broadcastUserAlert (channelID, message) {
    this.broadcast(ipc.TYPES.SEND_USER_ALERT, {
      channel: channelID,
      message
    })
  }

  sendNewArticle (newArticle, shard) {
    const { feedObject } = newArticle
    const debug = this.scheduleManager.isDebugging(feedObject._id)
    this.send(ipc.TYPES.NEW_ARTICLE, {
      debug,
      newArticle
    }, shard)
  }

  handleNewArticle (newArticle) {
    const { article, feedObject } = newArticle
    this.log.debug(`Got new feed $${feedObject._id} article ${article._id}`)
    if (this.shardsStopped.size > 0) {
      this.shardingManager.shards.forEach(shard => {
        const shardID = shard.id
        if (this.shardsStopped.has(shardID)) {
          this.log.debug(`Queueing feed ${feedObject._id} article ${article._id} for shard ${shardID} with some stopped shards`)
          this.queuedArticles.get(shardID).push(article)
        } else {
          this.log.debug(`Sending feed ${feedObject._id} article ${article._id} for shard ${shardID} with some stopped shards`)
          this.sendNewArticle(newArticle, shard)
        }
      })
    } else {
      this.log.debug(`Broadcasting feed ${feedObject._id} article ${article._id}`)
      this.broadcastNewArticle(newArticle)
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
      this.sendNewArticle(article, shard)
    }
    queue.length = 0
  }

  static validateCustomSchedules (customSchedules) {
    const config = getConfig()
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

  async start () {
    const shardCount = this.config.advanced.shards
    try {
      if (Supporter.isMongoDatabase) {
        this.mongo = await this.connectToDatabase()
      }
      await initialize.setupModels(this.mongo)
      await initialize.populateKeyValues()
      const schedules = await initialize.populateSchedules(this.customSchedules)
      this.scheduleManager.addSchedules(schedules)
      await this.shardingManager.spawn(shardCount || undefined)
    } catch (err) {
      if (err.headers) {
        const isJSON = err.headers.get('content-type') === 'application/json'
        const promise = isJSON ? err.json() : err.text()
        promise.then((response) => {
          this.log.error({ response }, 'ClientManager failed to start. Verify token and observe rate limits.')
        }).catch((parseErr) => {
          this.log.error(err, 'ClientManager failed to start')
          this.log.error(parseErr, `Failed to parse response from ClientManager spawn (Status ${err.status})`)
        }).finally(() => {
          this.kill()
        })
      } else {
        this.log.error(err, 'ClientManager failed to start')
        this.kill()
      }
    }
  }

  async connectToDatabase () {
    return connectDb(this.config.database.uri, this.config.database.connection)
  }

  messageHandler (shard, message) {
    if (!ipc.isValid(message)) {
      return
    }
    if (ipc.isLoopback(message)) {
      return this.shardingManager.broadcast(message)
        .catch(err => {
          this.log.error(err, `Sharding Manager broadcast message handling error for message type ${message.type}`)
          this.kill()
        })
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
    process.exit(1)
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
      this.log.debug('Running pre-init')
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
      this.log.info('All shards have initialized by the Sharding Manager.')
      this.sendQueuedArticles(shard)
      this.log.debug('Running post-init')
      await maintenance.prunePostInit(this.guildIdsByShard)
      this.log.debug('Post-init finished')
      if (Supporter.enabled) {
        Patron.refresh().catch(err => {
          this.log.error(err, 'Failed to refresh patrons')
        })
      }
      if (!devLevels.disableCycles()) {
        this.scheduleManager.beginTimers()
      }
      if (devLevels.dumpHeap()) {
        this.setupHeapDumps()
      }
      this.broadcast(ipc.TYPES.FINISHED_INIT)
      this.emit('finishInit')
    } catch (err) {
      this.log.fatal(err, 'Post-initialization failed in sharding manager')
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

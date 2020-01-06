process.env.DRSS = true
const Discord = require('discord.js')
const listeners = require('../util/listeners.js')
const initialize = require('../util/initialization.js')
const config = require('../config.js')
const ScheduleManager = require('./ScheduleManager.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const connectDb = require('../rss/db/connect.js')
const ClientManager = require('./ClientManager.js')
const Patron = require('./db/Patron.js')
const Supporter = require('./db/Supporter.js')
const EventEmitter = require('events')
const maintenance = require('../util/maintenance/index.js')
const DISABLED_EVENTS = ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE', 'PRESENCE_UPDATE', 'VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE', 'USER_NOTE_UPDATE', 'CHANNEL_PINS_UPDATE']
const CLIENT_OPTIONS = { disabledEvents: DISABLED_EVENTS, messageCacheMaxSize: 100 }
const STATES = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  READY: 'READY'
}
let webClient

class Client extends EventEmitter {
  constructor (settings, customSchedules) {
    super()
    if (settings.config) {
      config._overrideWith(settings.config)
    }
    if (config.web.enabled === true) {
      webClient = require('../web/index.js')
    }
    if (settings && Array.isArray(settings.suppressLogLevels)) {
      log.suppressLevel(settings.suppressLogLevels)
    }
    if (customSchedules) {
      if (!Array.isArray(customSchedules)) {
        throw new Error('customSchedules parameter must be an array of objects')
      } else {
        for (const schedule of customSchedules) {
          if (schedule.name === 'default') {
            throw new Error('Schedule name cannot be "default"')
          }
          const keys = Object.keys(schedule)
          if (!keys.includes('name')) {
            throw new Error('Schedule "name" must be defined')
          }
          if (!keys.includes('refreshRateMinutes')) {
            throw new Error('Schedule "refreshRateMinutes" must be defined')
          }
          if (!keys.includes('keywords') && !keys.includes('feedIDs')) {
            throw new Error('Schedule "keywords" or "feedIDs" must be defined')
          }
        }
      }
    }
    /**
     * Custom schedules gets written over by the ClientManager's
     * if it exists
     */
    this.customSchedules = customSchedules || []
    this.scheduleManager = undefined
    this.setPresence = settings.setPresence
    this.STATES = STATES
    this.state = STATES.STOPPED
    this.webClientInstance = undefined
  }

  async login (token) {
    if (this.bot) {
      return log.general.error('Cannot login when already logged in')
    }
    if (token instanceof Discord.ShardingManager) {
      return new ClientManager(token)
    }
    const isClient = token instanceof Discord.Client
    if (!isClient && typeof token !== 'string') {
      throw new TypeError('Argument must be a Discord.Client, Discord.ShardingManager, or a string')
    }
    const client = isClient ? token : new Discord.Client(CLIENT_OPTIONS)
    try {
      await connectDb()
      if (!isClient) {
        await client.login(token)
      }
      if (config.web.enabled === true && !this.webClientInstance && (!client.shard || client.shard.count === 0)) {
        this.webClientInstance = webClient()
      }
      this.bot = client
      this.shard = client.shard && client.shard.count > 0 ? client.shard.id : -1
      this.SHARD_PREFIX = client.shard && client.shard.count > 0 ? `SH ${client.shard.id} ` : ''
      storage.bot = client
      if (client.shard && client.shard.count > 0) {
        this.listenToShardedEvents(client)
      }
      if (!client.readyAt) {
        client.once('ready', this._setup.bind(this))
      } else {
        this._setup()
      }
    } catch (err) {
      if (err.message.includes('too many guilds')) {
        throw err
      } else if (!isClient) {
        log.general.error(`Discord.RSS unable to login, retrying in 10 minutes`, err)
        setTimeout(() => this.login.bind(this)(token), 600000)
      }
    }
  }

  _setup () {
    const bot = this.bot
    if (this.setPresence === true) {
      if (config.bot.activityType) bot.user.setActivity(config.bot.activityName, { type: config.bot.activityType, url: config.bot.streamActivityURL || undefined })
      else bot.user.setActivity(null)
      bot.user.setStatus(config.bot.status)
    }
    bot.on('error', err => {
      log.general.error(`${this.SHARD_PREFIX}Websocket error`, err)
      if (config.bot.exitOnSocketIssues === true) {
        log.general.info('Stopping all processes due to config.bot.exitOnSocketIssues')
        if (this.scheduleManager) {
          // Check if it exists first since it may disconnect before it's even initialized
          for (var sched of this.scheduleManager.scheduleList) sched.killChildren()
        }
        if (bot.shard && bot.shard.count > 0) bot.shard.send({ _drss: true, type: 'kill' })
        else process.exit(0)
      } else this.stop()
    })
    bot.on('resume', () => {
      log.general.success(`${this.SHARD_PREFIX}Websocket resumed`)
      this.start()
    })
    bot.on('disconnect', () => {
      log.general.error(`${this.SHARD_PREFIX}Websocket disconnected`)
      if (config.bot.exitOnSocketIssues === true) {
        log.general.info('Stopping all processes due to config.bot.exitOnSocketIssues')
        if (this.scheduleManager) {
          // Check if it exists first since it may disconnect before it's even initialized
          for (const sched of this.scheduleManager.scheduleList) {
            sched.killChildren()
          }
        }
        if (bot.shard && bot.shard.count > 0) {
          bot.shard.send({ _drss: true, type: 'kill' })
        } else {
          process.exit(0)
        }
      } else {
        this.stop()
      }
    })
    log.general.success(`${this.SHARD_PREFIX}Discord.RSS has logged in as "${bot.user.username}" (ID ${bot.user.id})`)
    if (!bot.shard || bot.shard.count === 0) {
      this.start()
    } else {
      process.send({
        _drss: true,
        type: 'shardReady',
        guildIds: bot.guilds.keyArray()
      })
    }
  }

  listenToShardedEvents (bot) {
    process.on('message', async message => {
      if (!message._drss) return
      try {
        switch (message.type) {
          case 'kill' :
            process.exit(0)
          case 'startInit':
            this.customSchedules = message.customSchedules
            this.start()
            break
          case 'stop':
            this.stop()
            break
          case 'finishedInit':
            storage.initialized = 2
            break
          case 'runSchedule':
            if (bot.shard.id === message.shardId) this.scheduleManager.run(message.refreshRate)
            break
        }
      } catch (err) {
        log.general.warning('client', err, true)
      }
    })
  }

  async start () {
    if (this.state === STATES.STARTING || this.state === STATES.READY) {
      return log.general.warning(`${this.SHARD_PREFIX}Ignoring start command because of ${this.state} state`)
    }
    const guildsArray = this.bot.guilds.keyArray()
    const guildIdsUnsharded = new Map()
    guildsArray.forEach(id => guildIdsUnsharded.set(id, -1))
    this.state = STATES.STARTING
    await listeners.enableCommands()
    const uri = config.database.uri
    log.general.info(`Database URI ${uri} detected as a ${uri.startsWith('mongo') ? 'MongoDB URI' : 'folder URI'}`)
    try {
      await connectDb()
      if (!this.bot.shard || this.bot.shard.count === 0) {
        if (Supporter.enabled) {
          await require('../../settings/api.js')()
        }
        await maintenance.prunePreInit(guildIdsUnsharded, this.bot)
        // Feeds must be pruned before calling prune subscribers
        await Promise.all([
          initialize.populatePefixes(),
          initialize.populateSchedules(this.customSchedules)
        ])
      }
      await initialize.populateRedis(this.bot)

      if (!this.scheduleManager) {
        const refreshRates = new Set()
        refreshRates.add(config.feeds.refreshRateMinutes)
        this.scheduleManager = new ScheduleManager(storage.bot)
        const names = new Set()
        for (const schedule of this.customSchedules) {
          const name = schedule.name
          if (name === 'example') {
            continue
          }
          if (names.has(name)) {
            throw new Error(`Schedules cannot have the same name (${name})`)
          }
          names.add(name)
          if (refreshRates.has(schedule.refreshRateMinutes)) {
            throw new Error('Duplicate schedule refresh rates are not allowed')
          }
          refreshRates.add(schedule.refreshRateMinutes)
        }
        await this.scheduleManager._registerSchedules()
        storage.scheduleManager = this.scheduleManager
      }
      storage.initialized = 2
      this.state = STATES.READY
      if (this.bot.shard && this.bot.shard.count > 0) {
        process.send({
          _drss: true,
          type: 'initComplete',
          shard: this.bot.shard.id,
          guilds: guildsArray
        })
      } else {
        await maintenance.prunePostInit(guildIdsUnsharded)
        if (config.web.enabled === true) {
          this.webClientInstance.enableCP()
        }
        this.maintenance = maintenance.cycle()
      }
      listeners.createManagers(storage.bot)
      this.scheduleManager.startSchedules()
      this.emit('finishInit')
    } catch (err) {
      log.general.error(`Client start`, err, true)
    }
  }

  stop () {
    if (this.state === STATES.STARTING || this.state === STATES.STOPPED) {
      return log.general.warning(`${this.SHARD_PREFIX}Ignoring stop command because of ${this.state} state`)
    }
    log.general.warning(`${this.SHARD_PREFIX}Discord.RSS has received stop command`)
    storage.initialized = 0
    this.scheduleManager.stopSchedules()
    clearInterval(this.maintenance)
    listeners.disableAll()
    if ((!storage.bot.shard || storage.bot.shard.count === 0) && config.web.enabled === true) {
      this.webClientInstance.disableCP()
    }
    this.state = STATES.STOPPED
  }

  async restart () {
    if (this.state === STATES.STARTING) return log.general.warning(`${this.SHARD_PREFIX}Ignoring restart command because of ${this.state} state`)
    if (this.state === STATES.READY) this.stop()
    return this.start()
  }

  disableCommands () {
    listeners.disableCommands()
    return this
  }
}

module.exports = Client

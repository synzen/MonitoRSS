const Discord = require('discord.js')
const listeners = require('../util/listeners.js')
const initialize = require('../util/initialization.js')
const config = require('../config.js')
const ScheduleManager = require('./ScheduleManager.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const dbOpsBlacklists = require('../util/db/blacklists.js')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const dbOpsGeneral = require('../util/db/general.js')
const dbOpsVips = require('../util/db/vips.js')
const redisIndex = require('../structs/db/Redis/index.js')
const checkConfig = require('../util/checkConfig.js')
const connectDb = require('../rss/db/connect.js')
const ClientManager = require('./ClientManager.js')
const EventEmitter = require('events')
const DISABLED_EVENTS = ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE', 'PRESENCE_UPDATE', 'VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE', 'USER_NOTE_UPDATE', 'CHANNEL_PINS_UPDATE']
const CLIENT_OPTIONS = { disabledEvents: DISABLED_EVENTS, messageCacheMaxSize: 100 }
const STATES = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  READY: 'READY'
}
let webClient

function overrideConfigs (configOverrides) {
  // Config overrides must be manually done for it to be changed in the original object (config)
  for (var category in config) {
    const configCategory = config[category]
    if (!configOverrides[category]) continue
    for (var configName in configCategory) {
      if (configOverrides[category][configName] !== undefined && configOverrides[category][configName] !== config[category][configName]) {
        log.general.info(`Overriding config.${category}.${configName} from ${JSON.stringify(config[category][configName])} to ${JSON.stringify(configOverrides[category][configName])} from configOverride.json`)
        configCategory[configName] = configOverrides[category][configName]
      }
    }
  }
}

class Client extends EventEmitter {
  constructor (configOverrides, customSchedules) {
    super()
    // Override from file first
    if (config.web.enabled === true) webClient = require('../web/index.js')
    // Then override from constructor
    if (configOverrides) overrideConfigs(configOverrides)
    const configRes = checkConfig.check(config)
    if (configRes && configRes.fatal) throw new Error(configRes.message)
    else if (configRes) log.general.warning(configRes.message)
    if (configOverrides && Array.isArray(configOverrides.suppressLogLevels)) log.suppressLevel(configOverrides.suppressLogLevels)
    if (customSchedules) {
      if (!Array.isArray(customSchedules)) throw new Error('customSchedules parameter must be an array of objects')
      else {
        for (const schedule of customSchedules) {
          if (schedule.name === 'default') throw new Error('Schedule name cannot be "default"')
          const keys = Object.keys(schedule)
          if (!keys.includes('name')) throw new Error('Schedule "name" must be defined')
          if (!keys.includes('refreshRateMinutes')) throw new Error('Schedule "refreshRateMinutes" must be defined')
          if (!keys.includes('keywords') && !keys.includes('feedIDs')) throw new Error('Schedule "keywords" or "feedIDs" must be defined')
        }
      }
    }
    this.scheduleManager = undefined
    this.configOverrides = configOverrides
    this.customSchedules = customSchedules
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
      this.SHARD_PREFIX = client.shard && client.shard.count > 0 ? `SH ${client.shard.id} ` : ''
      if (client.shard && client.shard.count > 0) {
        process.send({ _drss: true, type: 'spawned', shardId: client.shard.id, customSchedules: this.customSchedules && client.shard.id === 0 ? this.customSchedules : undefined })
      }
      storage.bot = client
      if (client.shard && client.shard.count > 0) this.listenToShardedEvents(client)
      if (!client.readyAt) {
        client.once('ready', this._initialize.bind(this))
      } else {
        this._initialize()
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

  _initialize () {
    const bot = storage.bot
    if (this.configOverrides && this.configOverrides.setPresence === true) {
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
        if (bot.shard && bot.shard.count > 0) bot.shard.send({ _drss: true, type: 'kill' })
        else process.exit(0)
      } else this.stop()
    })
    log.general.success(`${this.SHARD_PREFIX}Discord.RSS has logged in as "${bot.user.username}" (ID ${bot.user.id})`)
    if (!bot.shard || bot.shard.count === 0) this.start()
    else process.send({ _drss: true, type: 'shardReady', shardId: bot.shard.id })
  }

  listenToShardedEvents (bot) {
    process.on('message', async message => {
      if (!message._drss) return
      try {
        switch (message.type) {
          case 'kill' :
            process.exit(0)
          case 'startInit':
            if (bot.shard.id === message.shardId) this.start()
            break
          case 'stop':
            this.stop()
            break
          case 'finishedInit':
            storage.initialized = 2
            if (config.database.uri.startsWith('mongodb')) await dbOpsBlacklists.refresh()
            break
          case 'cycleVIPs':
            if (bot.shard.id === message.shardId) await dbOpsVips.refresh(true)
            break
          case 'runSchedule':
            if (bot.shard.id === message.shardId) this.scheduleManager.run(message.refreshRate)
            break
          case 'failedLinks._sendAlert':
            dbOpsFailedLinks._sendAlert(message.link, message.message, true)
            break
          case 'blacklists.uniformize':
            await dbOpsBlacklists.uniformize(message.blacklistGuilds, message.blacklistUsers, true)
            break
          case 'dbRestoreSend':
            const channel = bot.channels.get(message.channelID)
            if (!channel) return
            const channelMsg = channel.messages.get(message.messageID)
            if (channelMsg) channelMsg.edit('Database restore complete! Stopping bot process for manual reboot.').then(m => bot.shard.send({ _drss: true, type: 'kill' }))
            else channel.send('Database restore complete! Stopping bot process for manual reboot.').then(m => bot.shard.send({ _drss: true, type: 'kill' }))
            break
        }
      } catch (err) {
        log.general.warning('client', err, true)
      }
    })
  }

  stop () {
    if (this.state === STATES.STARTING || this.state === STATES.STOPPED) return log.general.warning(`${this.SHARD_PREFIX}Ignoring stop command because of ${this.state} state`)
    log.general.warning(`${this.SHARD_PREFIX}Discord.RSS has received stop command`)
    storage.initialized = 0
    this.scheduleManager.stopSchedules()
    clearInterval(this._vipInterval)
    listeners.disableAll()
    if ((!storage.bot.shard || storage.bot.shard.count === 0) && config.web.enabled === true) this.webClientInstance.disableCP()
    this.state = STATES.STOPPED
  }

  async start (callback) {
    if (this.state === STATES.STARTING || this.state === STATES.READY) return log.general.warning(`${this.SHARD_PREFIX}Ignoring start command because of ${this.state} state`)
    this.state = STATES.STARTING
    listeners.enableCommands()
    const uri = config.database.uri
    log.general.info(`Database URI ${uri} detected as a ${uri.startsWith('mongo') ? 'MongoDB URI' : 'folder URI'}`)
    try {
      await connectDb()
      if (!this.bot.shard || this.bot.shard.count === 0) {
        await dbOpsGeneral.verifyFeedIDs()
        await redisIndex.flushDatabase()
      }
      if (!this.scheduleManager) {
        const refreshRates = new Set()
        refreshRates.add(config.feeds.refreshRateMinutes)
        this.scheduleManager = new ScheduleManager(storage.bot)
        const addSchedulePromises = []
        addSchedulePromises.push(this.scheduleManager.addSchedule({ name: 'default', refreshRateMinutes: config.feeds.refreshRateMinutes }, false, true))
        if (config._vip === true) {
          if (!config._vipRefreshRateMinutes || config.feeds.refreshRateMinutes === config._vipRefreshRateMinutes) {
            throw new Error('Missing valid VIP refresh rate')
          }
          refreshRates.add(config._vipRefreshRateMinutes)
          addSchedulePromises.push(this.scheduleManager.addSchedule({ name: 'vip', refreshRateMinutes: config._vipRefreshRateMinutes, feedIDs: [] }, false, true))
        }
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
          addSchedulePromises.push(this.scheduleManager.addSchedule(schedule, false, true))
          if (refreshRates.has(schedule.refreshRateMinutes)) {
            throw new Error('Duplicate schedule refresh rates are not allowed')
          }
          refreshRates.add(schedule.refreshRateMinutes)
        }
        await Promise.all(addSchedulePromises)
        storage.scheduleManager = this.scheduleManager
      }
      await this.scheduleManager.assignAllSchedules()
      const { missingGuilds, linkTrackerDocs } = await initialize(this.bot)
      this._finishInit(missingGuilds, linkTrackerDocs, callback)
    } catch (err) {
      log.general.error(`Client start`, err, true)
    }
  }

  restart (callback) {
    if (this.state === STATES.STARTING) return log.general.warning(`${this.SHARD_PREFIX}Ignoring restart command because of ${this.state} state`)
    if (this.state === STATES.READY) this.stop()
    this.start(callback)
  }

  _finishInit (missingGuilds, linkDocs, callback) {
    storage.initialized = 2
    this.state = STATES.READY
    if (storage.bot.shard && storage.bot.shard.count > 0) {
      process.send({ _drss: true, type: 'initComplete', missingGuilds: missingGuilds, linkDocs: linkDocs, shard: storage.bot.shard.id })
    } else {
      if (config.web.enabled === true) this.webClientInstance.enableCP()
      if (config._vip) {
        this._vipInterval = setInterval(() => {
          dbOpsVips.refresh().catch(err => log.general.error('Unable to refresh vips on timer', err, true))
        }, 600000)
      }
    }
    listeners.createManagers(storage.bot)
    this.scheduleManager.startSchedules()
    // if (!this.bot.shard || this.bot.shard.count === 0) this.scheduleManager.run()
    if (callback) callback()
    this.emit('finishInit')
  }

  disableCommands () {
    listeners.disableCommands()
    return this
  }
}

module.exports = Client

const fs = require('fs')
const path = require('path')
const Discord = require('discord.js')
const listeners = require('../util/listeners.js')
const initialize = require('../util/initialization.js')
const config = require('../config.js')
const ScheduleManager = require('./ScheduleManager.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const dbOps = require('../util/dbOps.js')
const redisOps = require('../util/redisOps.js')
const checkConfig = require('../util/checkConfig.js')
const connectDb = require('../rss/db/connect.js')
const ClientManager = require('./ClientManager.js')
const EventEmitter = require('events')
const DISABLED_EVENTS = ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE', 'PRESENCE_UPDATE', 'VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE', 'USER_NOTE_UPDATE', 'CHANNEL_PINS_UPDATE']
const SHARDED_OPTIONS = { respawn: false }
const STATES = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  READY: 'READY'
}

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

function readSchedulesFromFile () {
  try {
    const files = fs.readdirSync(path.join(__dirname, '..', 'settings', 'schedules'))
    if (files.length === 0 || (files.length === 1 && files[0] === 'exampleSchedule.json')) return
    const arr = []
    for (var i = 0; i < files.length; ++i) {
      const fileName = files[i]
      if (fileName === 'exampleSchedule.json') continue
      try {
        const read = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'settings', 'schedules', fileName)))
        if (!read.keywords || !Array.isArray(read.keywords) || read.keywords.length === 0) {
          log.general.warning(`Skipping custom schedule ${fileName} due to missing keywords (array)`)
          continue
        }
        if (!read.refreshTimeMinutes) {
          log.general.warning(`Skipping custom schedule ${fileName} due to missing refreshTimeMinutes`)
          continue
        }
        read.name = fileName.replace(/\.json/gi, '')
        arr.push(read)
      } catch (err) {
        log.general.error(`Schedule ${fileName} is improperly configured\n`, err)
      }
    }
    return arr.length > 0 ? arr : undefined
  } catch (err) {
    log.general.info('Unable to read settings/schedules directory, skipping custom schedules', err)
  }
}

class Client extends EventEmitter {
  constructor (configOverrides, customSchedules) {
    super()
    // Override from file first
    try {
      const fileConfigOverride = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'settings', 'configOverride.json')))
      overrideConfigs(fileConfigOverride)
    } catch (err) {}
    // Then override from constructor
    if (configOverrides) overrideConfigs(configOverrides)
    const configRes = checkConfig.check(config)
    if (configRes && configRes.fatal) throw new Error(configRes.message)
    else if (configRes) log.general.warning(configRes.message)
    if (configOverrides && Array.isArray(configOverrides.suppressLogLevels)) log.suppressLevel(configOverrides.suppressLogLevels)
    if (customSchedules && !Array.isArray(customSchedules)) throw new Error('customSchedules parameter must be an array of objects')
    if (customSchedules && configOverrides && configOverrides.readFileSchedules === true) throw new Error('readFileSchedules config must be undefined if customSchedules (second) parameter is defined')
    if (!customSchedules && configOverrides && configOverrides.readFileSchedules === true) {
      customSchedules = readSchedulesFromFile()
      if (!customSchedules) log.general.info('No custom schedules found in settings/schedules folder')
    }
    this.scheduleManager = undefined
    this.configOverrides = configOverrides
    this.customSchedules = customSchedules
    this.STATES = STATES
    this.state = STATES.STOPPED
  }

  login (token, noChildren) {
    if (this.bot) return log.general.error('Cannot login when already logged in')
    if (token instanceof Discord.Client) return this._defineBot(token) // May also be the client
    if (token instanceof Discord.ShardingManager) return new ClientManager(token)
    if (typeof token === 'string') {
      const client = new Discord.Client({ disabledEvents: DISABLED_EVENTS, messageCacheMaxSize: 100 })
      return client.login(token)
        .then(tok => this._defineBot(client))
        .catch(err => {
          if (!noChildren && err.message.includes('too many guilds')) {
            const shardedClient = new ClientManager(new Discord.ShardingManager('./server.js', SHARDED_OPTIONS), this.configOverrides)
            shardedClient.once('finishInit', () => {
              this.emit('finishInit')
            })
          } else {
            log.general.error(`Discord.RSS unable to login, retrying in 10 minutes`, err)
            setTimeout(() => this.login.bind(this)(token), 600000)
          }
        })
    }
    throw new TypeError('Argument must be a Discord.Client, Discord.ShardingManager, or a string')
  }

  _defineBot (bot) {
    this.bot = bot
    this.SHARD_PREFIX = bot.shard && bot.shard.count > 0 ? `SH ${bot.shard.id} ` : ''
    if (bot && bot.shard && bot.shard.count > 0) {
      process.send({ _drss: true, type: 'spawned', shardId: bot.shard.id, customSchedules: this.customSchedules && bot.shard.id === 0 ? this.customSchedules : undefined })
    }
    storage.bot = bot
    if (bot.shard && bot.shard.count > 0) this.listenToShardedEvents(bot)
    if (!bot.readyAt) bot.once('ready', this._initialize.bind(this))
    else this._initialize()
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
          for (var sched of this.scheduleManager.scheduleList) sched.killChildren()
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
            if (bot.shard.id === message.shardId) this.start(null, message.vipApiData)
            break
          case 'stop':
            this.stop()
            break
          case 'finishedInit':
            storage.initialized = 2
            if (config.database.uri.startsWith('mongodb')) await dbOps.blacklists.refresh()
            break
          case 'cycleVIPs':
            if (bot.shard.id === message.shardId) await dbOps.vips.refresh(true, message.vipApiData)
            break
          case 'runSchedule':
            if (bot.shard.id === message.shardId) this.scheduleManager.run(message.refreshTime)
            break
          case 'failedLinks._sendAlert':
            dbOps.failedLinks._sendAlert(message.link, message.message, true)
            break
          case 'blacklists.uniformize':
            await dbOps.blacklists.uniformize(message.blacklistGuilds, message.blacklistUsers, true)
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
    this.state = STATES.STOPPED
  }

  start (callback, vipApiData) {
    if (this.state === STATES.STARTING || this.state === STATES.READY) return log.general.warning(`${this.SHARD_PREFIX}Ignoring start command because of ${this.state} state`)
    this.state = STATES.STARTING
    listeners.enableCommands()
    const uri = config.database.uri
    log.general.info(`Database URI ${uri} detected as a ${uri.startsWith('mongo') ? 'MongoDB URI' : 'folder URI'}`)
    connectDb()
      .then(() => !this.bot.shard || this.bot.shard.count === 0 ? redisOps.flushDatabase() : null)
      .then(() => config._vip && (!this.bot.shard || this.bot.shard.count === 0) ? require('../settings/api.js')() : null)
      .then(async clientVipApiData => {
        if (!this.scheduleManager) {
          this.scheduleManager = new ScheduleManager(storage.bot, this.customSchedules)
          storage.scheduleManager = this.scheduleManager
        }
        await this.scheduleManager.assignSchedules()
        return clientVipApiData
      })
      .then(clientVipApiData => {
        initialize(this.bot, (missingGuilds, linkDocs) => {
          // feedData is only defined if config.database.uri is a databaseless folder path
          this._finishInit(missingGuilds, linkDocs, callback)
        }, vipApiData || clientVipApiData)
      })
      .catch(err => log.general.error(`Client db connection`, err))
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
    } else if (config._vip) {
      this._vipInterval = setInterval(() => {
        dbOps.vips.refresh().catch(err => log.general.error('Unable to refresh vips on timer', err))
      }, 600000)
    }
    listeners.createManagers(storage.bot)
    this.scheduleManager.startSchedules()
    if (callback) callback()
    this.emit('finishInit')
  }

  disableCommands () {
    listeners.disableCommands()
    return this
  }
}

module.exports = Client

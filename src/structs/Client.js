process.env.DRSS = true
const Discord = require('discord.js')
const listeners = require('../util/listeners.js')
const initialize = require('../util/initialization.js')
const config = require('../config.js')
const ScheduleManager = require('./ScheduleManager.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const connectDb = require('../rss/db/connect.js')
const EventEmitter = require('events')
const DISABLED_EVENTS = ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE', 'PRESENCE_UPDATE', 'VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE', 'USER_NOTE_UPDATE', 'CHANNEL_PINS_UPDATE']
const CLIENT_OPTIONS = { disabledEvents: DISABLED_EVENTS, messageCacheMaxSize: 100 }
const STATES = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  READY: 'READY'
}

class Client extends EventEmitter {
  constructor () {
    super()
    this.scheduleManager = undefined
    this.STATES = STATES
    this.state = STATES.STOPPED
    this.customSchedules = []
  }

  async login (token) {
    if (this.bot) {
      return log.general.error('Cannot login when already logged in')
    }
    if (typeof token !== 'string') {
      throw new TypeError('Argument must a string')
    }
    const client = new Discord.Client(CLIENT_OPTIONS)
    try {
      await connectDb()
      await client.login(token)
      this.bot = client
      /** @type {number} */
      this.shardID = client.shard.ids[0]
      storage.bot = client
      this.listenToShardedEvents(client)
      if (!client.readyAt) {
        client.once('ready', this._setup.bind(this))
      } else {
        this._setup()
      }
    } catch (err) {
      if (err.message.includes('too many guilds')) {
        throw err
      } else {
        log.general.error(`Discord.RSS unable to login, retrying in 10 minutes`, err)
        setTimeout(() => this.login.bind(this)(token), 600000)
      }
    }
  }

  _setup () {
    const bot = this.bot
    bot.on('error', err => {
      log.general.error(`SH ${this.shardID} Websocket error`, err)
      if (config.bot.exitOnSocketIssues === true) {
        log.general.info('Stopping all processes due to config.bot.exitOnSocketIssues')
        if (this.scheduleManager) {
          // Check if it exists first since it may disconnect before it's even initialized
          for (const sched of this.scheduleManager.scheduleList) {
            sched.killChildren()
          }
        }
        bot.shard.send({ _drss: true, type: 'kill' })
      } else this.stop()
    })
    bot.on('resume', () => {
      log.general.success(`SH ${this.shardID} Websocket resumed`)
      this.start()
    })
    bot.on('disconnect', () => {
      log.general.error(`SH ${this.shardID} Websocket disconnected`)
      if (config.bot.exitOnSocketIssues === true) {
        log.general.info('Stopping all processes due to config.bot.exitOnSocketIssues')
        if (this.scheduleManager) {
          // Check if it exists first since it may disconnect before it's even initialized
          for (const sched of this.scheduleManager.scheduleList) {
            sched.killChildren()
          }
        }
        bot.shard.send({ _drss: true, type: 'kill' })
      } else {
        this.stop()
      }
    })
    log.general.success(`SH ${this.shardID} Discord.RSS has logged in as "${bot.user.username}" (ID ${bot.user.id})`)
    process.send({
      _drss: true,
      type: 'shardReady',
      guildIds: bot.guilds.keyArray()
    })
  }

  listenToShardedEvents (bot) {
    process.on('message', async message => {
      if (!message._drss) return
      try {
        switch (message.type) {
          case 'startInit':
            this.customSchedules = message.customSchedules
            config._overrideWith(message.config)
            log.suppressLevel(message.suppressLogLevels)
            if (message.setPresence) {
              if (config.bot.activityType) {
                bot.user.setActivity(config.bot.activityName, {
                  type: config.bot.activityType,
                  url: config.bot.streamActivityURL || undefined
                }).catch(err => log.general.error('Failed to set activity', err))
              } else {
                bot.user.setActivity(null)
                  .catch(err => log.general.error('Failed to set null activity', err))
              }
              bot.user.setStatus(config.bot.status)
                .catch(err => log.general.error('Failed to set status', err))
            }
            this.start()
            break
          case 'stop':
            this.stop()
            break
          case 'finishedInit':
            storage.initialized = 2
            break
          case 'runSchedule':
            if (this.shardID === message.shardId) {
              this.scheduleManager.run(message.refreshRate)
            }
            break
          case 'sendMessage':
            this.sendMessage(message.channel, message.message)
        }
      } catch (err) {
        log.general.warning('client', err, true)
      }
    })
  }

  sendMessage (channel, message) {
    const fetched = this.bot.channels.get(channel)
    if (!fetched) {
      return
    }
    fetched.send(message)
      .catch(err => log.general.error(`Failed to send global message for channel ${channel}`, err))
  }

  async start () {
    if (this.state === STATES.STARTING || this.state === STATES.READY) {
      return log.general.warning(`SH ${this.shardID} Ignoring start command because of ${this.state} state`)
    }
    this.state = STATES.STARTING
    await listeners.enableCommands()
    log.general.info(`${'SH ' + this.shardID + ' '}Commands have been ${config.bot.enableCommands !== false ? 'enabled' : 'disabled'}.`)
    const uri = config.database.uri
    log.general.info(`Database URI ${uri} detected as a ${uri.startsWith('mongo') ? 'MongoDB URI' : 'folder URI'}`)
    try {
      await connectDb()
      await initialize.populateRedis(this.bot)

      if (!this.scheduleManager) {
        const refreshRates = new Set()
        refreshRates.add(config.feeds.refreshRateMinutes)
        this.scheduleManager = new ScheduleManager(storage.bot, this.shardID)
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
      process.send({
        _drss: true,
        type: 'initComplete'
      })
      listeners.createManagers(storage.bot)
      this.emit('finishInit')
    } catch (err) {
      log.general.error(`Client start`, err, true)
    }
  }

  stop () {
    if (this.state === STATES.STARTING || this.state === STATES.STOPPED) {
      return log.general.warning(`SH ${this.shardID} Ignoring stop command because of ${this.state} state`)
    }
    log.general.warning(`SH ${this.shardID} Discord.RSS has received stop command`)
    storage.initialized = 0
    clearInterval(this.maintenance)
    listeners.disableAll()
    this.state = STATES.STOPPED
  }

  async restart () {
    if (this.state === STATES.STARTING) {
      return log.general.warning(`SH ${this.shardID} Ignoring restart command because of ${this.state} state`)
    }
    if (this.state === STATES.READY) {
      this.stop()
    }
    return this.start()
  }

  disableCommands () {
    listeners.disableCommands()
    return this
  }
}

module.exports = Client

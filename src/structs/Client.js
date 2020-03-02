process.env.DRSS = true
const Discord = require('discord.js')
const listeners = require('../util/listeners.js')
const initialize = require('../util/initialization.js')
const config = require('../config.js')
const Profile = require('./db/Profile.js')
const ArticleMessageQueue = require('./ArticleMessageQueue.js')
const storage = require('../util/storage.js')
const createLogger = require('../util/logger/create.js')
const connectDb = require('../util/connectDatabase.js')
const EventEmitter = require('events')
const ipc = require('../util/ipc.js')
const maintenance = require('../maintenance/index.js')
const DISABLED_EVENTS = [
  'TYPING_START',
  'MESSAGE_DELETE',
  'MESSAGE_UPDATE',
  'PRESENCE_UPDATE',
  'VOICE_STATE_UPDATE',
  'VOICE_SERVER_UPDATE',
  'USER_NOTE_UPDATE',
  'CHANNEL_PINS_UPDATE'
]
const STATES = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  READY: 'READY'
}
const CLIENT_OPTIONS = {
  disabledEvents: DISABLED_EVENTS,
  messageCacheMaxSize: 100
}

class Client extends EventEmitter {
  constructor () {
    super()
    this.STATES = STATES
    this.state = STATES.STOPPED
    this.articleMessageQueue = undefined
    this.log = undefined
  }

  async login (token) {
    if (this.bot) {
      return this.log.warn('Cannot login when already logged in')
    }
    if (typeof token !== 'string') {
      throw new TypeError('Argument must a string')
    }
    const client = new Discord.Client(CLIENT_OPTIONS)
    try {
      await connectDb('-')
      await client.login(token)
      this.log = createLogger(client.shard.ids[0].toString())
      this.bot = client
      this.articleMessageQueue = new ArticleMessageQueue(this.bot)
      this.shardID = client.shard.ids[0]
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
        this.log.warn(`Discord.RSS unable to login, retrying in 10 minutes`, err)
        setTimeout(() => this.login.bind(this)(token), 600000)
      }
    }
  }

  _setup () {
    const bot = this.bot
    bot.on('error', err => {
      this.log.warn(`Websocket error`, err)
      if (config.bot.exitOnSocketIssues === true) {
        this.log.warn('Stopping all processes due to config.bot.exitOnSocketIssues')
        ipc.send(ipc.TYPES.KILL)
      } else {
        this.stop()
      }
    })
    bot.on('resume', () => {
      this.log.info(`Websocket resumed`)
      this.start()
    })
    bot.on('disconnect', () => {
      this.log.warn(`SH ${this.shardID} Websocket disconnected`)
      if (config.bot.exitOnSocketIssues === true) {
        this.log.general.info('Stopping all processes due to config.bot.exitOnSocketIssues')
        ipc.send(ipc.TYPES.KILL)
      } else {
        this.stop()
      }
    })
    this.log.info(`Discord.RSS has logged in as "${bot.user.username}" (ID ${bot.user.id})`)
    ipc.send(ipc.TYPES.SHARD_READY, {
      guildIds: bot.guilds.cache.keyArray(),
      channelIds: bot.channels.cache.keyArray()
    })
  }

  listenToShardedEvents (bot) {
    process.on('message', async message => {
      if (!ipc.isValid(message)) {
        return
      }
      try {
        switch (message.type) {
          case ipc.TYPES.START_INIT:
            const data = message.data
            if (data.setPresence) {
              if (config.bot.activityType) {
                bot.user.setActivity(config.bot.activityName, {
                  type: config.bot.activityType,
                  url: config.bot.streamActivityURL || undefined
                }).catch(err => this.log.warn({
                  error: err
                }, 'Failed to set activity'))
              } else {
                bot.user.setActivity(null)
                  .catch(err => this.log.warn({
                    error: err
                  }, 'Failed to set null activity'))
              }
              bot.user.setStatus(config.bot.status)
                .catch(err => this.log.warn({
                  error: err
                }, 'Failed to set status'))
            }
            this.start()
            break
          case ipc.TYPES.NEW_ARTICLE:
            this.onNewArticle(message.data.article, message.data.debug)
            break
          case ipc.TYPES.FINISHED_INIT:
            storage.initialized = 2
            break
          case ipc.TYPES.SEND_CHANNEL_MESSAGE:
            this.sendChannelAlert(message.data.channel, message.data.message, message.data.alert)
              .catch(err => this.log.general.warning(`Failed at attempt to send inter-process message to channel ${message.channel}`, err))
            break
          case ipc.TYPES.SEND_USER_MESSAGE:
            this.sendUserAlert(message.data.channel, message.data.message)
              .catch(err => this.log.general.warning(`Failed at attempt to send inter-process message to user ${message.user}`, err))
        }
      } catch (err) {
        this.log.error(err, 'client')
      }
    })
  }

  async onNewArticle (article, debug) {
    const feed = article._feed
    const channel = this.bot.channels.cache.get(feed.channel)
    if (!channel) {
      return
    }
    try {
      await this.articleMessageQueue.enqueue(article, false, debug)
      await this.articleMessageQueue.send()
    } catch (err) {
      this.log.warn({
        error: err,
        guild: channel.guild,
        channel
      }, `Failed to send article ${article.link}`)
      if (err.code === 50035) {
        channel.send(`Failed to send formatted article for article <${article.link}>.\`\`\`${err.message}\`\`\``)
          .catch(err => this.log.warn({
            error: err
          }, `Unable to send failed-to-send message for article`))
      }
    }
  }

  async sendChannelAlert (channel, message, alert) {
    if (config.dev === true) {
      return
    }
    const fetched = this.bot.channels.cache.get(channel)
    if (!fetched) {
      return
    }
    if (!alert) {
      return fetched.send(`**ALERT**\n\n${message}`)
    }
    try {
      this.sendUserAlertFromChannel(channel, message)
    } catch (err) {
      return this.sendChannelAlert(channel, message, false)
    }
  }

  async sendUserAlert (channel, message) {
    if (config.dev === true) {
      return
    }
    const fetchedChannel = this.bot.channels.cache.get(channel)
    if (!fetchedChannel) {
      return
    }
    const profile = await Profile.get(fetchedChannel.guild.id)
    if (!profile) {
      return
    }
    const alertTo = profile.alert
    for (const id of alertTo) {
      const user = this.bot.users.cache.get(id)
      if (user) {
        await user.send(`**ALERT**\n\n${message}`)
      }
    }
  }

  async start () {
    if (this.state === STATES.STARTING || this.state === STATES.READY) {
      return this.log.warn(`Ignoring start command because of ${this.state} state`)
    }
    this.state = STATES.STARTING
    await listeners.enableCommands(this.bot)
    this.log.info(`Commands have been ${config.bot.enableCommands !== false ? 'enabled' : 'disabled'}.`)
    const uri = config.database.uri
    this.log.info(`Database URI ${uri} detected as a ${uri.startsWith('mongo') ? 'MongoDB URI' : 'folder URI'}`)
    try {
      await connectDb()
      await Promise.all([
        maintenance.pruneWithBot(this.bot),
        initialize.populateRedis(this.bot)
      ])
      storage.initialized = 2
      this.state = STATES.READY
      ipc.send(ipc.TYPES.INIT_COMPLETE)
      listeners.createManagers(this.bot)
      this.emit('finishInit')
    } catch (err) {
      this.log.error(err, `Client start`)
    }
  }

  stop () {
    if (this.state === STATES.STARTING || this.state === STATES.STOPPED) {
      return this.log.warn(`Ignoring stop command because of ${this.state} state`)
    }
    this.log.info(`Discord.RSS has received stop command`)
    storage.initialized = 0
    clearInterval(this.maintenance)
    listeners.disableAll(this.bot)
    this.state = STATES.STOPPED
    ipc.send(ipc.TYPES.SHARD_STOPPED)
  }

  async restart () {
    if (this.state === STATES.STARTING) {
      return this.log.warn(`Ignoring restart command because of ${this.state} state`)
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

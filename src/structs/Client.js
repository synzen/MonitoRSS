process.env.DRSS = true
const Discord = require('discord.js')
const EventEmitter = require('events')
const listeners = require('../util/listeners.js')
const maintenance = require('../maintenance/index.js')
const ipc = require('../util/ipc.js')
const Profile = require('./db/Profile.js')
const ArticleMessage = require('./ArticleMessage.js')
const Feed = require('./db/Feed.js')
const FeedData = require('./FeedData.js')
const ArticleMessageRateLimiter = require('./ArticleMessageRateLimiter.js')
const initialize = require('../util/initialization.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')
const connectDb = require('../util/connectDatabase.js')
const { once } = require('events')

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
      this.log = createLogger('-')
      await client.login(token)
      this.log = createLogger(client.shard.ids[0].toString())
      this.bot = client
      this.shardID = client.shard.ids[0]
      this.listenToShardedEvents(client)
      if (!client.readyAt) {
        await once(client, 'ready')
        this._setup()
      } else {
        this._setup()
      }
    } catch (err) {
      if (err.message.includes('too many guilds')) {
        throw err
      } else {
        this.log.warn({
          error: err
        }, 'Discord.RSS failed to start, retrying in 10 minutes')
        setTimeout(() => this.login.bind(this)(token), 600000)
      }
    }
  }

  async connectToDatabase () {
    const config = getConfig()
    return connectDb(config.database.uri, config.database.connection)
  }

  _setup () {
    const bot = this.bot
    bot.on('error', err => {
      this.log.warn('Websocket error', err)
      const config = getConfig()
      if (config.bot.exitOnSocketIssues === true) {
        this.log.warn('Stopping all processes due to config.bot.exitOnSocketIssues')
        ipc.send(ipc.TYPES.KILL)
      } else {
        this.stop()
      }
    })
    bot.on('resume', () => {
      this.log.info('Websocket resumed')
      this.start()
    })
    bot.on('disconnect', () => {
      this.log.warn(`SH ${this.shardID} Websocket disconnected`)
      const config = getConfig()
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
          case ipc.TYPES.START_INIT: {
            const data = message.data
            if (data.setPresence) {
              const config = getConfig()
              bot.user.setPresence({
                status: config.bot.status,
                activity: {
                  name: config.bot.activityName,
                  type: config.bot.activityType,
                  url: config.bot.streamActivityURL || undefined
                }
              }).catch(err => this.log.warn({
                error: err
              }, 'Failed to set presence'))
            }
            this.start()
            break
          }
          case ipc.TYPES.NEW_ARTICLE:
            this.onNewArticle(message.data.newArticle, message.data.debug)
            break
          case ipc.TYPES.FINISHED_INIT:
            break
          case ipc.TYPES.SEND_USER_ALERT:
            this.sendUserAlert(message.data.channel, message.data.message)
              .catch(err => this.log.warn(`Failed to send inter-process alert to channel ${message.data.channel}`, err))
        }
      } catch (err) {
        this.log.error(err, 'client')
      }
    })
  }

  async onNewArticle (newArticle, debug) {
    const config = getConfig()
    if (config.dev === true) {
      return
    }
    const { article, feedObject } = newArticle
    const channel = this.bot.channels.cache.get(feedObject.channel)
    try {
      if (!channel) {
        this.log.debug(`No channel found for article ${article._id} of feed ${feedObject._id}`)
        return
      }
      const feedData = await FeedData.ofFeed(new Feed(feedObject))
      const articleMessage = new ArticleMessage(this.bot, article, feedData, debug)
      await ArticleMessageRateLimiter.enqueue(articleMessage)
      this.log.debug(`Sent article ${article._id} of feed ${feedObject._id}`)
    } catch (err) {
      if (err.message.includes('Rate limit')) {
        this.log.debug({
          error: err
        }, 'Ignoring rate-limited article')
        return
      }
      const article = newArticle.article
      this.log.warn({
        error: err,
        guild: channel.guild,
        channel
      }, `Failed to send article ${article.link}`)
      if (err.code === 50035) {
        channel.send(`Failed to send formatted article for article <${article.link}>.\`\`\`${err.message}\`\`\``)
          .catch(err => this.log.warn({
            error: err
          }, 'Unable to send failed-to-send message for article'))
      }
    }
  }

  async sendChannelMessage (channelID, message) {
    const channel = this.bot.channels.cache.get(channelID)
    if (!channel) {
      return
    }
    /**
     * @type {import('discord.js').GuildMember}
     */
    const guildMeMember = channel.guild.me
    if (!guildMeMember.permissionsIn(channel).has(Discord.Permissions.FLAGS.SEND_MESSAGES)) {
      this.log.warn({
        channel,
        string: message
      }, 'Failed to send Client message to channel')
      return
    }
    channel.send(message)
  }

  async sendUserAlert (channelID, message) {
    const config = getConfig()
    if (config.dev === true) {
      return
    }
    const fetchedChannel = this.bot.channels.cache.get(channelID)
    if (!fetchedChannel) {
      return
    }
    const alertMessage = `**ALERT**\n\n${message}`
    try {
      const profile = await Profile.get(fetchedChannel.guild.id)
      if (!profile) {
        return this.sendChannelMessage(channelID, alertMessage)
      }
      const alertTo = profile.alert
      for (const id of alertTo) {
        const user = this.bot.users.cache.get(id)
        if (user) {
          await user.send(alertMessage)
        }
      }
    } catch (err) {
      this.log.warn({
        error: err
      }, `Failed to send user alert to channel ${channelID}`)
      return this.sendChannelMessage(alertMessage)
    }
  }

  async start () {
    if (this.state === STATES.STARTING || this.state === STATES.READY) {
      return this.log.warn(`Ignoring start command because of ${this.state} state`)
    }
    const config = getConfig()
    this.state = STATES.STARTING
    try {
      if ((this.mongo && this.mongo.readyState !== 1) || Profile.isMongoDatabase) {
        this.mongo = await this.connectToDatabase()
      }
      await initialize.setupModels(this.mongo)
      await initialize.setupCommands()
      const uri = config.database.uri
      this.log.info(`Database URI detected as a ${uri.startsWith('mongo') ? 'MongoDB URI' : 'folder URI'}`)
      await maintenance.pruneWithBot(this.bot)
      this.state = STATES.READY
      if (config.bot.enableCommands) {
        await listeners.enableCommands(this.bot)
      }
      await initialize.setupRateLimiters(this.bot)
      this.log.info(`Commands have been ${config.bot.enableCommands ? 'enabled' : 'disabled'}.`)
      ipc.send(ipc.TYPES.INIT_COMPLETE)
      listeners.createManagers(this.bot)
      this.emit('finishInit')
    } catch (err) {
      this.log.error(err, 'Client start')
    }
  }

  stop () {
    if (this.state === STATES.STARTING || this.state === STATES.STOPPED) {
      return this.log.warn(`Ignoring stop command because of ${this.state} state`)
    }
    this.log.info('Discord.RSS has received stop command')
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
}

module.exports = Client

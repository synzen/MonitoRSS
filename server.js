const Discord = require('discord.js')
const listeners = require('./util/listeners.js')
const initialize = require('./util/initialization.js')
const config = require('./config.json')
const ScheduleManager = require('./util/ScheduleManager.js')
const storage = require('./util/storage.js')
const log = require('./util/logger.js')
const currentGuilds = storage.currentGuilds
if (config.logging.logDates === true) require('./util/logDates.js')()
const configRes = require('./util/configCheck.js').check(config)
const connectDb = require('./rss/db/connect.js')
const DISABLED_EVENTS = ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE', 'PRESENCE_UPDATE', 'VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE', 'USER_NOTE_UPDATE', 'CHANNEL_PINS_UPDATE']

if (configRes && configRes.fatal) throw new Error(configRes.message)
else if (configRes) log.general.info(configRes.message)

let restartTime = config.feedSettings.refreshTimeMinutes * 60000 / 4 * 10
restartTime = restartTime < 60000 ? Math.ceil(restartTime * 4) : Math.ceil(restartTime) // Try to make sure it's never below a minute
const restartTimeDisp = (restartTime / 1000 / 60).toFixed(2)

let scheduleManager
let bot

// Function to handle login/relogin automatically
let loginAttempts = 0
const maxAttempts = 5

bot = new Discord.Client({disabledEvents: DISABLED_EVENTS})
const SHARD_ID = bot.shard ? 'SH ' + bot.shard.id + ' ' : ''

function login (firstStartup) {
  if (!firstStartup) bot = new Discord.Client({disabledEvents: DISABLED_EVENTS})

  bot.login(config.botSettings.token)
  .catch(err => {
    if (loginAttempts++ >= maxAttempts) {
      log.general.error(`${SHARD_ID}Discord.RSS failed to login after ${maxAttempts} attempts. Terminating.`)
      if (bot.shard) bot.shard.send('kill')
    }
    log.general.error(`${SHARD_ID}Discord.RSS failed to login (${err}) on attempt #${loginAttempts}, retrying in ${restartTimeDisp} minutes...`)
    setTimeout(login, restartTime)
  })

  bot.once('ready', function () {
    loginAttempts = 0
    bot.user.setPresence({ game: { name: (config.botSettings.defaultGame && typeof config.botSettings.defaultGame === 'string') ? config.botSettings.defaultGame : null, type: 0 } })
    log.general.info(`${SHARD_ID}Discord.RSS has logged in as "${bot.user.username}" (ID ${bot.user.id}), processing set to ${config.advanced.processorMethod}`)
    if (firstStartup) {
      if (config.botSettings.enableCommands !== false) listeners.enableCommands(bot)
      connectDb((err) => {
        if (err) throw err
        initialize(bot, finishInit)
      })
    } else scheduleManager = new ScheduleManager(bot)
  })
}

function finishInit (guildsInfo) {
  storage.initializing = false
  if (bot.shard) process.send({type: 'initComplete', guilds: guildsInfo})
  scheduleManager = new ScheduleManager(bot)
  listeners.createManagers(bot)
}

if (!bot.shard || (bot.shard && bot.shard.count === 1)) login(true)
else {
  process.on('message', function (message) {
    if (message.type === 'startInit' && bot.shard && bot.shard.id === message.shardId) {
      login(true)
    } else if (message.type === 'runSchedule' && bot.shard && bot.shard.id === message.shardId) {
      scheduleManager.run(message.refreshTime)
    } else if (message.type === 'updateGuild' && bot.shard) {
      const guildRss = message.guildRss
      const guild = bot.guilds.get(guildRss.id)
      if (!guild) return
      if (guildRss === undefined) currentGuilds.delete(guildRss.id)
      else currentGuilds.set(guildRss.id, guildRss)
    } else if (message.type === 'updateFailedLinks') {
      storage.failedLinks = message.failedLinks
    } else if (message.type === 'dbRestoreSend') {
      const channel = bot.channels.get(message.channelID)
      if (!channel) return
      const channelMsg = channel.messages.get(message.messageID)
      if (channelMsg) channelMsg.edit('Database restore complete! Stopping bot process for manual reboot.').then(m => bot.shard.send('kill'))
      else channel.send('Database restore complete! Stopping bot process for manual reboot.').then(m => bot.shard.send('kill'))
    }
  })
}

process.on('uncaughtException', err => {
  console.log(`${SHARD_ID}Fatal Error\n`, err)
  if (bot.shard) {
    bot.shard.broadcastEval('process.exit()')
    bot.shard.send('kill')
  }
  process.exit()
})

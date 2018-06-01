const Discord = require('discord.js')
const listeners = require('./util/listeners.js')
const initialize = require('./util/initialization.js')
const config = require('./config.json')
const ScheduleManager = require('./util/ScheduleManager.js')
const storage = require('./util/storage.js')
const log = require('./util/logger.js')
const dbOps = require('./util/dbOps.js')
const configRes = require('./util/configCheck.js').check(config)
const connectDb = require('./rss/db/connect.js')
const DISABLED_EVENTS = ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE', 'PRESENCE_UPDATE', 'VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE', 'USER_NOTE_UPDATE', 'CHANNEL_PINS_UPDATE']
process.env.initializing = 'true' // Environemnt variables must be strings

if (configRes && configRes.fatal) throw new Error(configRes.message)
else if (configRes) log.general.info(configRes.message)

let restartTime = config.feeds.refreshTimeMinutes * 60000 / 4 * 10
restartTime = restartTime < 60000 ? Math.ceil(restartTime * 4) : Math.ceil(restartTime) // Try to make sure it's never below a minute
const restartTimeDisp = (restartTime / 1000 / 60).toFixed(2)

let scheduleManager
let bot

// Function to handle login/relogin automatically
let loginAttempts = 0
const maxAttempts = 5

bot = new Discord.Client({disabledEvents: DISABLED_EVENTS})
const SHARD_ID = bot.shard ? 'SH ' + bot.shard.id + ' ' : ''

async function login (firstStartup) {
  if (!firstStartup) bot = new Discord.Client({disabledEvents: DISABLED_EVENTS})
  storage.bot = bot
  try {
    await bot.login(config.bot.token)
    loginAttempts = 0
    if (config.bot.activityType) bot.user.setActivity(config.bot.activityName, { type: config.bot.activityType })
    else bot.user.setActivity(null)
    bot.user.setStatus(config.bot.status)

    log.general.info(`${SHARD_ID}Discord.RSS has logged in as "${bot.user.username}" (ID ${bot.user.id}), processing set to ${config.advanced.processorMethod}`)
    if (firstStartup) {
      listeners.enableCommands(bot)
      connectDb((err) => {
        if (err) throw err
        initialize(bot, finishInit)
      })
    } else scheduleManager = new ScheduleManager(bot)
  } catch (err) {
    if (loginAttempts++ >= maxAttempts) {
      log.general.error(`${SHARD_ID}Discord.RSS failed to login after ${maxAttempts} attempts. Terminating.`)
      if (bot.shard) bot.shard.send('kill')
    }
    log.general.error(`${SHARD_ID}Discord.RSS failed to login (${err}) on attempt #${loginAttempts}, retrying in ${restartTimeDisp} minutes...`)
    setTimeout(login, restartTime)
  }
}

function finishInit (guildsInfo, missingGuilds, linkDocs) {
  storage.initialized = 1
  process.env.initializing = 'false'

  if (bot.shard) dbOps.failedLinks.uniformize(storage.failedLinks, () => process.send({ type: 'initComplete', guilds: guildsInfo, missingGuilds: missingGuilds, linkDocs: linkDocs, shard: bot.shard.id }))
  else {
    storage.initialized = 2
    setInterval(dbOps.vips.refresh, 600000)
  }
  scheduleManager = new ScheduleManager(bot)
  listeners.createManagers(bot)
}

if (!bot.shard || (bot.shard && bot.shard.count === 1)) login(true)
else {
  process.on('message', message => {
    switch (message.type) {
      case 'startInit':
        if (bot.shard.id === message.shardId) login(true)
        break
      case 'finishedInit':
        storage.initialized = 2
        dbOps.blacklists.refresh()
        break
      case 'cycleVIPs':
        if (bot.shard.id === message.shardId) dbOps.vips.refresh()
        break
      case 'runSchedule':
        if (bot.shard.id === message.shardId) scheduleManager.run(message.refreshTime)
        break
      case 'guildRss.update':
        if (bot.guilds.has(message.guildRss.id)) dbOps.guildRss.update(message.guildRss, null, true)
        break
      case 'guildRss.remove':
        if (bot.guilds.has(message.guildRss.id)) dbOps.guildRss.remove(message.guildRss, null, true)
        break
      case 'guildRss.disableFeed':
        if (bot.guilds.has(message.guildRss.id)) dbOps.guildRss.disableFeed(message.guildRss, message.rssName, null, true)
        break
      case 'guildRss.enableFeed':
        if (bot.guilds.has(message.guildRss.id)) dbOps.guildRss.enableFeed(message.guildRss, message.rssName, null, true)
        break
      case 'guildRss.removeFeed':
        if (bot.guilds.has(message.guildRss.id)) dbOps.guildRss.removeFeed(message.guildRss, message.rssName, null, true)
        break
      case 'failedLinks.uniformize':
        dbOps.failedLinks.uniformize(message.failedLinks, null, true)
        break
      case 'failedLinks._sendAlert':
        dbOps.failedLinks._sendAlert(message.link, message.message, true)
        break
      case 'blacklists.uniformize':
        dbOps.blacklists.uniformize(message.blacklistGuilds, message.blacklistUsers, null, true)
        break
      case 'vips.uniformize':
        dbOps.vips.uniformize(message.vipUsers, message.vipServers, null, true)
        break
      case 'dbRestoreSend':
        const channel = bot.channels.get(message.channelID)
        if (!channel) return
        const channelMsg = channel.messages.get(message.messageID)
        if (channelMsg) channelMsg.edit('Database restore complete! Stopping bot process for manual reboot.').then(m => bot.shard.send('kill'))
        else channel.send('Database restore complete! Stopping bot process for manual reboot.').then(m => bot.shard.send('kill'))
        break
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

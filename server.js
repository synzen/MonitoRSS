const Discord = require('discord.js')
const listeners = require('./util/listeners.js')
const initialize = require('./util/initialization.js')
const config = require('./config.json')
const configCheck = require('./util/configCheck.js')
const ScheduleManager = require('./util/ScheduleManager.js')
const storage = require('./util/storage.js')
const currentGuilds = storage.currentGuilds
if (config.logging.logDates === true) require('./util/logDates.js')()

const results = configCheck.checkMasterConfig(config)
if (results && results.fatal) throw new Error(results.message)
else if (results) console.info(results.message)

let restartTime = config.feedSettings.refreshTimeMinutes * 60000 / 4 * 10
restartTime = restartTime < 60000 ? Math.ceil(restartTime * 4) : Math.ceil(restartTime) // Try to make sure it's never below a minute
const restartTimeDisp = (restartTime / 1000 / 60).toFixed(2)

// Ease the pains of having to rewrite a function every time to check an empty object
Object.defineProperty(Object.prototype, 'size', {
  value: function () {
    let c = 0
    for (var x in this) if (this.hasOwnProperty(x)) c++
    return c
  },
  enumerable: false,
  writable: true
})

let scheduleManager
let bot

// Function to handle login/relogin automatically
let loginAttempts = 0
let maxAttempts = 5

bot = new Discord.Client({disabledEvents: ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE']})

function login (firstStartup) {
  if (!firstStartup) bot = new Discord.Client({disabledEvents: ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE']})

  bot.login(config.botSettings.token)
  .catch(err => {
    if (loginAttempts++ >= maxAttempts) throw new Error(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Discord.RSS failed to login after ${maxAttempts} attempts.`)
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Discord.RSS failed to login (${err}), retrying in ${restartTimeDisp} minutes...`)
    setTimeout(login, restartTime)
  })

  bot.once('ready', function () {
    loginAttempts = 0
    bot.user.setPresence({ game: { name: (config.botSettings.defaultGame && typeof config.botSettings.defaultGame === 'string') ? config.botSettings.defaultGame : null, type: 0 } })
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Discord.RSS has logged in as "${bot.user.username}" (ID ${bot.user.id}), processing set to ${config.advanced.processorMethod}.`)
    if (firstStartup) initialize(bot, finishInit)
    else scheduleManager = new ScheduleManager(bot)
  })

  bot.once('disconnect', function (e) {
    if (loginAttempts++ >= maxAttempts) throw new Error(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Discord.RSS failed to login after ${maxAttempts} attempts.`)

    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Error: Disconnected from Discord. Attempting to reconnect after ${restartTimeDisp} minutes.`)

    var timer = setInterval(function () {
      if (scheduleManager && scheduleManager.cyclesInProgress()) return console.log('Feed retrieval cycles are currently in progress. Waiting until cycles end to reconnect.')
      if (scheduleManager) scheduleManager.stopSchedules()
      clearInterval(timer)
      login()
    }, restartTime)
  })
}

function finishInit (guildsInfo) {
  if (bot.shard) process.send({type: 'initComplete', guilds: guildsInfo})
  scheduleManager = new ScheduleManager(bot)
  if (!bot.shard) {
    try {
      require('./web/app.js')(bot)
    } catch (e) {}
  }
  listeners.createManagers(bot)

  if (config.botSettings.enableCommands !== false) listeners.enableCommands(bot)
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
      if (!bot.guilds.get(guildRss.id)) return
      if (guildRss === undefined) currentGuilds.delete(guildRss.id)
      else currentGuilds.set(guildRss.id, guildRss)
    }
  })
}

process.on('uncaughtException', function (err) {
  console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Fatal Error!\n`, err)
  if (bot.shard) {
    bot.shard.broadcastEval('process.exit()')
    bot.shard.send('kill')
  }
  process.exit()
})

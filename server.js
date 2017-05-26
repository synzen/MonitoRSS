const Discord = require('discord.js')
const listeners = require('./util/listeners.js')
const initialize = require('./util/initialization.js')
const config = require('./config.json')
const configCheck = require('./util/configCheck.js')
const ScheduleManager = require('./util/ScheduleManager.js')
if (config.logging.logDates === true) require('./util/logDates.js')()

if (Discord.version !== '11.1.0') throw new Error('Discord.js is not updated to 11.1.0, please update.')

const results = configCheck.checkMasterConfig(config)
if (results && results.fatal) throw new Error(results.message)
else if (results) console.info(results.message)

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
let initialized = false
let bot

// Function to handle login/relogin automatically
let loginAttempts = 0
let maxAttempts = 2;

(function login () {
  bot = new Discord.Client({disabledEvents: ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE']})

  bot.login(config.botSettings.token)
  .catch(err => {
    if (loginAttempts++ >= maxAttempts) throw new Error(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Discord.RSS failed to login after ${maxAttempts} attempts.`)
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Discord.RSS could not login (${err}), retrying in 60 seconds...`)
    setTimeout(login, 20000)
  })

  bot.once('ready', function () {
    loginAttempts = 0
    bot.user.setGame((config.botSettings.defaultGame && typeof config.botSettings.defaultGame === 'string') ? config.botSettings.defaultGame : null)
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Discord.RSS has logged in, processing set to ${config.advanced.processorMethod}.`)
    if (!initialized) initialize(bot, finishInit)
    else scheduleManager = new ScheduleManager(bot)
  })

  bot.once('disconnect', function (e) {
    if (loginAttempts++ >= maxAttempts) throw new Error(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Discord.RSS failed to login after ${maxAttempts} attempts.`)

    let restartTime = config.feedSettings.refreshTimeMinutes * 60000 / 4 * 10
    restartTime = restartTime < 60000 ? Math.ceil(restartTime * 4) : Math.ceil(restartTime) // Try to make sure it's never below a minute
    restartTime = 5000

    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Error: Disconnected from Discord. Attempting to reconnect after ~${restartTime / 1000 / 60} minutes.`)

    var timer = setInterval(function () {
      if (scheduleManager && scheduleManager.cyclesInProgress()) return console.log('Feed retrieval cycles are currently in progress. Waiting until cycles end to reconnect.')
      if (scheduleManager) scheduleManager.stopSchedules()
      clearInterval(timer)
      login()
    }, restartTime)
  })
})()

function finishInit () {
  initialized = true
  scheduleManager = new ScheduleManager(bot)
  listeners.createManagers(bot)

  if (config.botSettings.enableCommands !== false) listeners.enableCommands(bot)
}

process.on('uncaughtException', function (err) {
  console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Fatal Error!\n`, err)
  if (bot.shard) {
    bot.shard.broadcastEval('process.exit()')
    bot.shard.send('kill')
  }
  process.exit()
})

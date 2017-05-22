const Discord = require('discord.js')
const listeners = require('./util/listeners.js')
const initialize = require('./util/initialization.js')
const config = require('./config.json')
const storage = require('./util/storage.js')
const currentGuilds = storage.currentGuilds
const changedGuilds = storage.changedGuilds
const deletedGuilds = storage.deletedGuilds
const sendToDiscord = require('./util/sendToDiscord.js')
const debugFeeds = require('./util/debugFeeds.js').list
const ScheduleManager = require('./util/ScheduleManager.js')
if (config.logging.logDates == true) require('./util/logDates.js')()
var cmdServer

function hasNonStrings(array) {
  for (var item in array) {
    return typeof array[item] !== 'string'
  }
}

// Add checks for common mistakes for important configs
if (Discord.version !== '11.1.0') throw new Error('Discord.js is not updated to 11.1.0, please update.');
else if (config.advanced.processorMethod && config.advanced.processorMethod === 'parallel' && config.feedManagement.sqlType !== 'mysql') throw new Error('processorMethod cannot be isolated or parallel if database type is not mysql.');
else if (!config.botSettings.token) throw new Error('Token undefined in config.');
else if (!config.botSettings.prefix) throw new Error('Prefix undefined in config');
else if (!config.feedManagement.databaseName) throw new Error('databaseName undefined in config.');
else if (!config.feedManagement.sqlType || typeof config.feedManagement.sqlType !== 'string' || (config.feedManagement.sqlType !== 'mysql' && config.feedManagement.sqlType !== 'sqlite3')) throw new Error('sqlType incorrectly defined in config.');
else if (!config.feedSettings.defaultMessage) throw new Error('defaultMessage undefined in config.');

if (config.feedSettings.cycleMaxAge != null && (isNaN(parseInt(config.feedSettings.cycleMaxAge, 10)) || config.feedSettings.cycleMaxAge === 0 || config.feedSettings.cycleMaxAge < 0)) console.log('Config Warning: cycleMaxAge is incorrectly defined. Defaulting to 1.');
if (isNaN(parseInt(config.feedSettings.defaultMaxAge, 10)) || config.feedSettings.defaultMaxAge === 0 || config.feedSettings.defaultMaxAge < 0) console.log('Config Warning: defaultMaxAge is incorrectly defined. Defaulting to 1.');

if (config.botSettings.enableCommands != true && config.botSettings.enableCommands != false) console.log('Config Warning: enableCommands is incorrectly defined, defaulting to true.')

if (config.advanced.processorMethod && !['single', 'parallel', 'isolated'].includes(config.advanced.processorMethod)) {
  console.log('Config Warning: processorMethod is incorrectly defined, defaulting to \'single\' method.');
  config.advanced.processorMethod = 'single';
}

if (typeof config.botSettings.controllerIds !== 'object' || config.botSettings.controllerIds.length > 0 && hasNonStrings(config.botSettings.controllerIds)) console.log(`Config Warning: controllerIds has one or more items incorrectly defined. Please see wiki for reference.`);

// Ease the pains of having to rewrite a function every time to check an empty object
Object.defineProperty(Object.prototype, 'size', {
    value: function() {
      let c = 0
      for (var x in this) if (this.hasOwnProperty(x)) c++;
      return c
    },
    enumerable: false,
    writable: true
})

let scheduleManager
let initialized = false
let bot

// Function to handle login/relogin automatically
let loginAttempts = 0;
let maxAttempts = 15

;(function login() {
  bot = new Discord.Client({disabledEvents: ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE']})

  bot.login(config.botSettings.token)
  .catch(err => {
    if (loginAttempts++ >= maxAttempts) throw new Error(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Discord.RSS failed to login after ${maxAttempts} attempts.`);
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Discord.RSS could not login (${err}), retrying in 60 seconds...`)
    setTimeout(login, 20000)
  })

  bot.once('ready', function() {
    loginAttempts = 0
    bot.user.setGame((config.botSettings.defaultGame && typeof config.botSettings.defaultGame === 'string') ? config.botSettings.defaultGame : null)
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Discord.RSS has logged in.`);
    if (!initialized) initialize(bot, finishInit);
    else scheduleManager = new ScheduleManager(bot);
  })

  bot.once('disconnect', function(e) {
    if (loginAttempts++ >= maxAttempts) throw new Error(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Discord.RSS failed to login after ${maxAttempts} attempts.`);

    let restartTime = config.feedSettings.refreshTimeMinutes * 60000 / 4 * 10
    restartTime = restartTime < 60000 ? Math.ceil(restartTime * 4) : Math.ceil(restartTime) // Try to make sure it's never below a minute
    restartTime = 5000

    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Error: Disconnected from Discord. Attempting to reconnect after ~${restartTime / 1000 / 60} minutes.`)

    var timer = setInterval(function () {
      if (scheduleManager && scheduleManager.cyclesInProgress()) return console.log('Feed retrieval cycles are currently in progress. Waiting until cycles end to reconnect.');
      if (scheduleManager) scheduleManager.stopSchedules();
      clearInterval(timer)
      login()
    }, restartTime)

  })

})()

function finishInit() {
  initialized = true
  scheduleManager = new ScheduleManager(bot)
  listeners.createManagers(bot)

  if (config.botSettings.enableCommands != false) listeners.enableCommands(bot);

}

process.on('unhandledRejection', function(err, promise) {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err)
})

process.on('uncaughtException', function(err) {
  console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Fatal Error!\n`, err)
  if (bot.shard) {
    bot.shard.broadcastEval('process.exit()');
    bot.shard.send('kill');
  }
  process.exit()
})

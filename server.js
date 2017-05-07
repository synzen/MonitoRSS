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
if (config.logging.logDates) require('./util/logDates.js')()
var cmdServer

if (Discord.version !== '11.1.0') throw new Error('Discord.js is not updated to 11.1.0, please update.');
else if (config.advanced.processorMethod === 'parallel' && config.feedManagement.sqlType !== 'mysql') throw new Error('processorMethod cannot be isolated or parallel if database type is not mysql.');
else if (!config.botSettings.token) throw new Error('Token undefined in config.');
else if (!config.botSettings.prefix) throw new Error('Prefix undefined in config');
else if (!config.feedManagement.databaseName) throw new Error('databaseName undefined in config.');
else if (!config.feedManagement.sqlType || typeof config.feedManagement.sqlType !== 'string' || (config.feedManagement.sqlType !== 'mysql' && config.feedManagement.sqlType !== 'sqlite3')) throw new Error('sqlType incorrectly defined in config.');
else if (!config.feedSettings.defaultMessage) throw new Error('defaultMssage undefined in config.');

if (config.advanced.processorMethod && !['single', 'parallel', 'isolated'].includes(config.advanced.processorMethod)) {
  console.log('Processor method was incorrectly defined, defaulting to \'single\' method.');
  config.advanced.processorMethod = 'single';
}

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

(function login() {
  if (loginAttempts++ === 20) throw new Error(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Discord.RSS failed to login after 20 attempts. Terminating.`);
  bot = new Discord.Client({disabledEvents: ['TYPING_START', 'MESSAGE_DELETE', 'MESSAGE_UPDATE']})

  bot.login(config.botSettings.token)
  .catch(err => {
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Discord.RSS could not login (${err}), retrying...`)
    setTimeout(login, 20000)
  })

  bot.once('ready', function() {
    loginAttempts = 0
    bot.user.setGame((config.botSettings.defaultGame && typeof config.botSettings.defaultGame === 'string') ? config.botSettings.defaultGame : null)
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Discord.RSS has started.`);
    if (!initialized) initialize(bot, finishInit);
    else scheduleManager = new ScheduleManager(bot);
  })

  bot.once('disconnect', function(e) {
    console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ': ''}Error: Disconnected from Discord. Attempting to reconnect and restart feed schedules.`)

    var timer = setInterval(function () {
      if (scheduleManager.cyclesInProgress()) return console.log('Feed retrieval cycles are currently in progress. Waiting until cycles end to reconnect.');
      scheduleManager.stopSchedules()
      clearInterval(timer)
      login()
    }, Math.floor(config.feedSettings.refreshTimeMinutes * 60000 / 4))

  })

})()

function finishInit() {
  initialized = true
  scheduleManager = new ScheduleManager(bot)
  listeners.createManagers(bot)

  if (config.botSettings.enableCommands == true) listeners.enableCommands(bot);

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

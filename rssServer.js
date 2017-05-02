const Discord = require('discord.js')
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

if (!config.botSettings.token) throw new Error('Token undefined in config.');
else if (!config.botSettings.prefix) throw new Error('Prefix undefined in config');
else if (!config.feedManagement.databaseName) throw new Error('databaseName undefined in config.');
else if (!config.feedManagement.sqlType || typeof config.feedManagement.sqlType !== 'string' || (config.feedManagement.sqlType !== 'mysql' && config.feedManagement.sqlType !== 'sqlite3')) throw new Error('sqlType incorrectly defined in config.');
else if (!config.feedSettings.defaultMessage) throw new Error('defaultMssage undefined in config.');

function addDebug(rssName) {
  let found = false
  currentGuilds.forEach(function(guildRss, guildId) {
    const rssList = guildRss.sources
    for (var name in rssList) {
      if (rssName === name) {
        found = true;
        debugFeeds.push(rssName);
        console.log(`Added ${rssName} to debugging list.`);
      }
    }
  })
  if (!found) console.log(`Unable to add ${rssName} to debugging list, not found in any guild sources.`);
}

function removeDebug(rssName) {
  if (!debugFeeds.includes(rssName)) return console.log(`Cannot remove, ${rssName} is not in debugging list.`);
  for (var index in debugFeeds) {
    if (debugFeeds[index] === rssName) {
      debugFeeds.splice(index, 1);
      return console.log(`Removed ${rssName} from debugging list.`);
    }
  }
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
  if (loginAttempts++ === 20) throw new Error('Discord.RSS RSS module failed to login after 20 attempts. Terminating.');
  bot = new Discord.Client({disabledEvents: ['TYPING_START', 'MESSAGE_CREATE', 'MESSAGE_DELETE', 'MESSAGE_UPDATE']})

  bot.login(config.botSettings.token)
  .catch(err => {
    console.log(`Discord.RSS RSS module could not login (${err}), retrying...`)
    setTimeout(login, 20000)
  })

  bot.once('ready', function() {
    loginAttempts = 0
    bot.user.setGame((config.botSettings.defaultGame && typeof config.botSettings.defaultGame === 'string') ? config.botSettings.defaultGame : null)
    console.log('Discord.RSS RSS Module has started.');
    if (!initialized) initialize(bot, finishInit);
    else scheduleManager = new ScheduleManager(bot);
  })

  bot.once('disconnect', function(e) {
    console.log('Error: RSS Module Disconnected from Discord. Attempting to reconnect and restart feed schedules.')

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

  if (config.botSettings.enableCommands === false) return;

  const cmdServer = require('child_process').fork('./cmdServer.js', {env: {isCmdServer: true} }) // Start Discord events handler child process

  cmdServer.on('message', function(message) {
    if (message === 'killbot') return bot.destroy();
    if (message === 'kill') return process.exit();
    if (message.type === 'gameChange') {
      config.botSettings.defaultGame = message.contents;
      return bot.user.setGame(message.contents);
    }

    if (message.type === 'configChange') {
      config[message.configCategory][message.configName] = message.configSetting;
      delete require.cache[require.resolve('./config.json')];
    }

    // For debugging feeds
    if (message.type === 'debug') addDebug(message.contents);
    if (message.type === 'undebug') removeDebug(message.contents);

     // "Queue" guilds to be updated sent from child process if cycle is in progress
    if (message.type === 'guildUpdate') return changedGuilds.set(message.id, message.contents);
    if (message.type === 'guildDeletion') return deletedGuilds.push(message.id);
  })

  process.on('uncaughtException', function(err) { // Send signal to kill child process if parent process (this) e3ncounters an error
    console.log(`Fatal Error for RSS Module! Stopping bot, printing error:\n\n`, err.stack)
    cmdServer.send('kill')
    process.exit(1)
  })

}


process.on('unhandledRejection', function(err, promise) {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err)
})

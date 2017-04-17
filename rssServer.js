const Discord = require('discord.js')
const startInit = require('./util/initFeeds.js')
const config = require('./config.json')
const startFeedSchedule = require('./util/feedSchedule.js')
const fetchInterval = require('./util/fetchInterval.js')
const currentGuilds = fetchInterval.currentGuilds
const changedGuilds = fetchInterval.changedGuilds
const deletedGuilds = fetchInterval.deletedGuilds
if (config.logging.logDates) require('./util/logDates.js')()

if (!config.botSettings.token) throw new Error('Vital config missing: token undefined in config.');
else if (!config.botSettings.prefix) throw new Error('Vital config missing: prefix undefined in config');
else if (!config.feedManagement.databaseName) throw new Error('Vital config missing: databaseName undefined in config.');
else if (!config.feedManagement.sqlType || typeof config.feedManagement.sqlType !== 'string' || (config.feedManagement.sqlType !== 'mysql' && config.feedManagement.sqlType !== 'sqlite3')) throw new Error('Vital config missing: sqlType incorrectly defined in config.');
else if (!config.feedSettings.defaultMessage) throw new Error('Vital config missing: defaultMssage undefined in config.');

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
    if (!initialized) startInit(bot, startCmdServer);
    else require('./util/feedSchedule.js')(bot);
  })
  bot.once('disconnect', function(e) {
    console.log('Error: RSS Module Disconnected from Discord. Attempting to reconnect and restart feed cycle.')
    var timer = setInterval(function () {
      if (fetchInterval.cycleInProgress) return console.log('Feed retrieval cycle currently in progress. Waiting until cycle ends to reconnect.');
      fetchInterval.stopSchedule()
      clearInterval(timer)
      login()
    }, Math.floor(config.feedSettings.refreshTimeMinutes * 60000 / 4))
  })
})()

// Start Discord events handler child process
function startCmdServer() {
  initialized = true
  require('./util/feedSchedule.js')(bot) // Start feed fetch schedule after events handler process has begun

  if (config.botSettings.enableCommands === false) return;

  const cmdServer = require('child_process').fork('./cmdServer.js', {env: {isCmdServer: true} })

  cmdServer.on('message', function(message) {
    if (message === 'kill') return process.exit();
    if (message.type === 'gameChange') {
      config.botSettings.defaultGame = message.contents;
      return bot.user.setGame(message.contents);
    }

     // "Queue" guilds to be updated sent from child process if cycle is in progress
    if (message.type === 'guildUpdate') return changedGuilds.set(message.id, message.contents);
    else if (message.type === 'guildDeletion') return deletedGuilds.push(message.id);
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

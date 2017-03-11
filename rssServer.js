const Discord = require('discord.js')
const startInit = require('./util/initFeeds.js')
const config = require('./config.json')
const startFeedSchedule = require('./util/feedSchedule.js')
const fetchInterval = require('./util/fetchInterval.js')
const currentGuilds = fetchInterval.currentGuilds
const changedGuilds = fetchInterval.changedGuilds
const deletedGuilds = fetchInterval.deletedGuilds
if (config.logging.logDates) require('./util/logDates.js')();

if (!config.botSettings.token) throw 'Warning! Vital config missing: token undefined in config.';
else if (!config.botSettings.prefix) throw 'Warning! Vital config missing: prefix undefined in config';
else if (!config.feedManagement.databaseName) throw 'Warning! Vital config missing: databaseName undefined in config.';
else if (!config.feedManagement.sqlType || typeof config.feedManagement.sqlType !== 'string' || (config.feedManagement.sqlType !== 'mysql' && config.feedManagement.sqlType !== 'sqlite3')) throw 'Warning! Vital config missing: sqlType incorrectly defined in config.';
else if (!config.feedSettings.defaultMessage) throw 'Warning! Vital config missing: defaultMssage undefined in config.';

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
let bot;

// Function to handle login/relogin automatically
(function login () {
  let attempts = 0
  if (attempts++ === 10) throw 'Discord.RSS RSS module failed to login after 10 attempts. Terminating.';
  bot = new Discord.Client()
  bot.login(config.botSettings.token)
  .catch(err => {
    console.log(`Discord.RSS RSS module could not login, retrying...`)
    setTimeout(login, 1000)
  })
  bot.once('ready', function() {
    console.log('Discord.RSS RSS Module has started.');
    if (!initialized) startInit(bot, startCmdServer);
    else require('./util/feedSchedule.js')(bot);
  })
  bot.once('disconnect', function (e) {
    console.log('Error: RSS Module Disconnected from Discord. Attempting to reconnect and restart feed cycle.')
    var timer = setInterval(function () {
      if (fetchInterval.cycleInProgress) return console.log('Feed retrieval cycle currently in progress. Waiting until cycle ends to reconnect.');
      fetchInterval.stopSchedule()
      clearInterval(timer)
      login()
    }, Math.floor(config.feedSettings.refreshTimeMinutes * 60000 / 3))
  })
})()

// Start Discord events handler child process
function startCmdServer () {
  initialized = true
  require('./util/feedSchedule.js')(bot) // Start feed fetch schedule after events handler process has begun

  const cmdServer = require('child_process').fork('./cmdServer.js', {env: {isCmdServer: true} }) // Pass the currentGuilds to the child process so it doesn't have to get them on its own

  cmdServer.on('message', function (guildFile) {
    if (guildFile === 'kill') process.exit();
    if (guildFile.type === 'update') changedGuilds[guildFile.id] = guildFile.contents; // "Queue" guilds to be updated
    else if (guildFile.type === 'deletion') deletedGuilds.push(guildFile.id);

    if (fetchInterval.cycleInProgress) return; // Update guild only when cycle is not in progress to avoid errors mid-RSS process

    if (guildFile.type === 'deletion') {
        for (var index in deletedGuilds) {
          const guildId = deletedGuilds[index];
          if (currentGuilds[guildId]) {
            delete currentGuilds[guildId];
            console.log(`RSS Module immediately deleted profile for guild ID: ${guildId}`);
          }
          deletedGuilds.splice(index, 1);
          if (changedGuilds[guildId]) delete changedGuilds[guildId]; // Changed profile is useless now that the guild is deleted
        }
        return;
    }

    currentGuilds[guildFile.id] = guildFile.contents
    console.log(`RSS Module immediately updated profile of guild ID: ${guildFile.id}`)
    delete changedGuilds[guildFile.id]
  })

  process.on('uncaughtException', function (err) { // Send signal to kill child process if parent process (this) e3ncounters an error
    console.log(`Fatal Error for RSS Module! Stopping bot, printing error:\n\n`, err.stack)
    cmdServer.send('kill')
    process.exit(1)
  })

}

process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err)
})

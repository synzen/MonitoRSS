const Discord = require('discord.js')
const startInit = require('./util/initFeeds.js')
const config = require('./config.json')
const fetchInterval = require('./util/fetchInterval.js')
const startFeedSchedule = require('./util/startFeedSchedule.js')
if (config.logging.logDates) require('./util/logDates.js')();

var initialized = false
var bot

function beginFeedCycle (deleteCache) {
  if (deleteCache) delete require.cache[require.resolve(`./util/startFeedSchedule.js`)];
  require('./util/startFeedSchedule.js')(bot)
}

function startCmdServer () {
  initialized = true
  const cmdServer = require('child_process').fork('./cmdServer.js', {env: {isCmdServer: true} })

  cmdServer.on('message', function (guildFile) {
    if (guildFile === 'kill') process.exit();
    try {
      delete require.cache[require.resolve(`./sources/${guildFile}.json`)]
      console.log("RSS Module now using new and updated file for guild ID: " + guildFile)
    } catch (e) {}
  })

  process.on('uncaughtException', function (err) {
    console.log(`Fatal Error for RSS Module! Stopping bot, printing error:\n\n`, err.stack)
    cmdServer.send('kill')
    process.exit(1)
  })
  beginFeedCycle()
}



(function login () {
  bot = new Discord.Client()
  bot.login(config.botSettings.token)

  bot.once('ready', function() {
    if (typeof config.botSettings.defaultGame === "string" && config.botSettings.defaultGame !== "") bot.user.setGame(config.botSettings.defaultGame);
    console.log("Discord.RSS RSS Module has started.")
    if (!initialized) startInit(bot, startCmdServer);
    else beginFeedCycle(true);
  })
  bot.once('disconnect', function (e) {
    console.log('Error: RSS Module Disconnected from Discord. Attempting to reconnect and restart feed cycle.')
    var timer = setInterval(function () {
      if (fetchInterval.cycleInProgress) return console.log('Cycle currently in progress. Waiting until cycle ends.');
      fetchInterval.stopSchedule()
      clearInterval(timer)
      login()
    }, 10000)
  })
})()

process.on("unhandledRejection", (err, promise) => {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err)
})

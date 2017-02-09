const Discord = require('discord.js')
const bot = new Discord.Client()
const initRSS = require('./util/initFeeds.js')
const config = require('./config.json')

if (config.logging.logDates) require('./util/logDates.js')();

bot.on('ready', function() {
  if (typeof config.botSettings.defaultGame === "string" && config.botSettings.defaultGame !== "") bot.user.setGame(config.botSettings.defaultGame);
  console.log("Discord.RSS RSS Module has started.")
  initRSS(bot, startCommands)
  bot.removeAllListeners('ready')
})

function startCommands () {
  const cmdServer = require('child_process').fork('./cmdServer.js', {env: {isCmdServer: true} });

  cmdServer.on('message', function (guildFile) {
    if (guildFile === 'kill') process.exit();
    try {
      delete require.cache[require.resolve(`./sources/${guildFile}.json`)];
      console.log("RSS Module now using new and updated file for guild ID: " + guildFile);
    } catch (e) {}
  })

  process.on('uncaughtException', function (err) {
    console.log(`Fatal Error for RSS Module! Stopping bot, printing error:\n\n`, err.stack)
    cmdServer.send('kill')
    process.exit(1)
  })

}

bot.login(config.botSettings.token)

process.on("unhandledRejection", (err, promise) => {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err);
})

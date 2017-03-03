const Discord = require('discord.js')
const config = require('./config.json')
const cmdListeners = require('./util/cmdListeners.js')
var bot

if (config.logging.logDates) require('./util/logDates.js')();

Object.defineProperty(Object.prototype, 'size', {
    value: function() {
      let c = 0
      for (var x in this) if (this.hasOwnProperty(x)) c++;
      return c
    },
    enumerable: false,
    writable: true
});

(function login() {
  if (!config.botSettings.menuColor || isNaN(parseInt(config.botSettings.menuColor))) config.botSettings.menuColor = '7833753';
  bot = new Discord.Client()
  bot.login(config.botSettings.token)
  .catch(err => {
    console.log(`Discord.RSS commands module could not login, retrying...`)
    setTimeout(login, 1000)
  })
  cmdListeners.createAllListeners(bot)
  bot.once('disconnect', function (e) {
    console.log('Discord.RSS commands module has been disconneted. Reconnecting...')
    cmdListeners.removeAllListeners(bot)
    login()
  })
})()

// process.on('unhandledRejection', function (err, promise) {
//   console.log('Unhandled Rejection at: Promise', promise, 'reason:', err);
// })

process.on('uncaughtException', function (err) {
  console.log(`Fatal Error for Commands Module! Stopping bot, printing error:\n\n`, err.stack)
  process.send('kill')
  process.exit(1)
})

process.on('message', function (message) {
  if (message === 'kill') process.exit(1);
})

const fs = require('fs')
const Discord = require('discord.js')
const config = require('./config.json')
const cmdListeners = require('./util/cmdListeners.js')
const fetchInterval = require('./util/fetchInterval.js')
const currentGuilds = fetchInterval.currentGuilds
let initialized = false
let bot

if (config.logging.logDates) require('./util/logDates.js')();

// Ease the pains of having to rewrite a function every time to check an empty object
Object.defineProperty(Object.prototype, 'size', {
    value: function() {
      let c = 0
      for (var x in this) if (this.hasOwnProperty(x)) c++;
      return c
    },
    enumerable: false,
    writable: true
});

function getCurrentGuilds(bot) {
  fs.readdir('./sources', function (err, files) {
    if (err) throw err;
    files.forEach(function(guildFile) {
      const guildId = guildFile.replace(/.json/g, '')
      if (bot.guilds.get(guildId)) {   // Check if it is a valid guild in bot's guild collection
        try { // Store the guild's profile
          currentGuilds.set(guildId, JSON.parse(fs.readFileSync(`./sources/${guildFile}`)))
        }
        catch(e) {
          console.log(`Commands Warning: Unable to store ${guildFile}, could not read contents. (${e})`)
        }
      }
      else if (guildFile !== 'guild_id_here.json' && guildFile !== 'backup') console.log(`Commands Warning: Unable to store ${guildFile}, was not found in bot's guild list.`);
    })
  });
}

let loginAttempts = 0;
(function login() { // Function to handle login/relogin automatically
  if (loginAttempts++ === 20) {
    process.send('kill');
    throw new Error('Discord.RSS commands module failed to login after 20 attempts. Terminating.');
  }
  if (!config.botSettings.menuColor || isNaN(parseInt(config.botSettings.menuColor))) config.botSettings.menuColor = '7833753';
  bot = new Discord.Client()

  bot.login(config.botSettings.token)
  .then(tok => {
    loginAttempts = 0
    bot.user.setGame((config.botSettings.defaultGame && typeof config.botSettings.defaultGame === 'string') ? config.botSettings.defaultGame : null)
    console.log('Discord.RSS commands module activated and online.')
    if (!initialized) getCurrentGuilds(bot);
    cmdListeners.createAllListeners(bot)
  })
  .catch(err => {
    console.log(`Discord.RSS commands module could not login (${err}), retrying...`)
    setTimeout(login, 20000)
  })

  bot.once('disconnect', function (e) {
    console.log('Discord.RSS commands module has been disconneted. Reconnecting...')
    cmdListeners.removeAllListeners(bot)
    login()
  })

})()

// process.on('unhandledRejection', function (err, promise) {
//   console.log('Unhandled Rejection at: Promise', promise, 'reason:', err);
// })

// Kill the parent process if this child process encounters an error
process.on('uncaughtException', function (err) {
  console.log(`Fatal Error for Commands Module! Stopping bot, printing error:\n\n`, err.stack)
  process.send('kill')
  process.exit(1)
})

// Exit process if parent process tells child process (this) to die
process.on('message', function (message) {
  if (message === 'kill') process.exit(1);
})

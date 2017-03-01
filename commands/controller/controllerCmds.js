const config = require('../../config.json')
const Discord = require('discord.js')

exports.stats = function (bot, message) {
  message.channel.sendMessage(`Guilds: ${bot.guilds.size}\nUsers: ${bot.users.size}\nChannels: ${bot.channels.size}`).catch(err => console.log("Could not send stats, reason:\n", err))
}

exports.setgame = function (bot, message) {
  let content = message.content.split(" ")
  content.shift()
  let game = content.join(" ")
  if (game == "null") game = null
  bot.user.setGame(game)
  config.botSettings.defaultGame = game
}

exports.pingme = function (bot, message) {
  var pong = new Discord.RichEmbed()
  .setTitle('Sending...')
  .setDescription('pong!')

  message.channel.sendEmbed(embed).catch(err => console.info(`Could not send the embed:\n`, pong))
}

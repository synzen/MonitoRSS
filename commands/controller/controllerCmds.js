const config = require('../../config.json')
const Discord = require('discord.js')
const util = require('util')

exports.stats = function(bot, message) {
  message.channel.sendMessage(`Guilds: ${bot.guilds.size}\nUsers: ${bot.users.size}\nChannels: ${bot.channels.size}`).catch(err => console.log("Commands Info: Could not send stats, reason:\n", err))
}

exports.setgame = function(bot, message) {
  const content = message.content.split(" ")
  content.shift()
  const game = content.join(" ")
  if (game == "null") game = null;
  bot.user.setGame(game)
  config.botSettings.defaultGame = game
}

exports.pingme = function(bot, message) {
  const pong = new Discord.RichEmbed()
  .setTitle('Sending')
  .setDescription('pong!')

  message.channel.sendEmbed(pong).catch(err => console.info(`Commands Warning: Could not send the pong embed:\n`, pong))
}

exports.memuse = function (bot, message) {
  message.channel.sendMessage(util.inspect(process.memoryUsage()))
}

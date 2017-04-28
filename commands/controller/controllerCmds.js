const config = require('../../config.json')
const Discord = require('discord.js')
const util = require('util')
const currentGuilds = require('../../util/guildStorage.js').currentGuilds

exports.stats = function(bot, message) {
  message.channel.sendMessage(`Guilds: ${bot.guilds.size}\nUsers: ${bot.users.size}\nChannels: ${bot.channels.size}`).catch(err => console.log('Commands Info: Could not send stats, reason:\n', err))
}

exports.setgame = function(bot, message) {
  const content = message.content.split(' ')
  content.shift()
  let game = content.join(' ')
  if (game === 'null') game = null;
  bot.user.setGame(game)
  config.botSettings.defaultGame = game // Make sure the change is saved even after a login retry
  process.send({type: 'gameUpdate', contents: game})
}

exports.pingme = function(bot, message) {
  const pong = new Discord.RichEmbed()
  .setTitle('Sending')
  .setDescription('pong!')

  message.channel.sendEmbed(pong).catch(err => console.info(`Commands Warning: Could not send the pong embed:\n`, pong))
}

exports.getsources = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return;
  const sources = (currentGuilds.get(content[1]) && currentGuilds.get(content[1]).sources) ? currentGuilds.get(content[1]).sources : undefined

  if (sources) message.channel.sendMessage(`\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``);
  else message.channel.sendMessage('No sources available.');
}

exports.debug = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return;

  process.send({type: 'debug', contents: content[1]})
}

exports.undebug = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return;

  process.send({type: 'undebug', contents: content[1]})
}

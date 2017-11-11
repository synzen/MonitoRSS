const Discord = require('discord.js')

exports.normal = function (bot, message) {
  const pong = new Discord.RichEmbed()
  .setTitle('Sending')
  .setDescription('pong!')

  message.channel.send({embed: pong}).catch(err => console.info(`Commands Warning: Could not send the pong embed (${err})\n`, pong))
}

exports.sharded = exports.normal

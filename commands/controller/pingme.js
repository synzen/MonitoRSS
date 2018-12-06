const Discord = require('discord.js')
const log = require('../../util/logger.js')

exports.normal = function (bot, message) {
  const pong = new Discord.RichEmbed()
    .setTitle('Sending')
    .setDescription('pong!')

  message.channel.send({ embed: pong }).catch(err => log.controller.warning(`Could not send the pong embed`, err))
}

exports.sharded = exports.normal

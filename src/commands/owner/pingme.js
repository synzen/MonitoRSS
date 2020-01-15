const Discord = require('discord.js')
const log = require('../../util/logger.js')

module.exports = function (bot, message) {
  const pong = new Discord.RichEmbed()
    .setTitle('Sending')
    .setDescription('pong!')

  message.channel.send({ embed: pong }).catch(err => log.owner.warning(`Could not send the pong embed`, err))
}

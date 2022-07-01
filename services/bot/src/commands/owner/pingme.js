const Discord = require('discord.js')

module.exports = async (message) => {
  const pong = new Discord.MessageEmbed()
    .setTitle('Sending')
    .setDescription('pong!')

  await message.channel.send({ embed: pong })
}

const { MessageEmbed } = require('discord.js')
const getConfig = require('../../../../config.js').get

class ThemedEmbed extends MessageEmbed {
  constructor (...args) {
    super(...args)
    const config = getConfig()
    this.setColor(config.bot.menuColor)
  }
}

module.exports = ThemedEmbed

const { DiscordPromptRunner } = require('discord.js-prompts')
const createLogger = require('../util/logger/create.js')

module.exports = (message) => {
  if (DiscordPromptRunner.isActiveChannel(message.channel.id)) {
    DiscordPromptRunner.deleteActiveChannel(message.channel.id)
    message.react('☑').catch(err => {
      const log = createLogger(message.guild.shard.id)
      log.warn(err, 'Unable to react checkmark for successful forceexit')
      message.channel.send('Successfully cleared this channel from active status.')
        .catch(err => {
          const log = createLogger(message.guild.shard.id)
          log.warn(err, 'forceexit')
        })
    })
  } else {
    message.react('❌').catch(err => {
      const log = createLogger(message.guild.shard.id)
      log.warn(err, 'Unable to react xmark for failed forceexit')
    })
  }
}

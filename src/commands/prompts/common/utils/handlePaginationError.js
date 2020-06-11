const { MessageEmbed } = require('discord.js')
const createLogger = require('../../../../util/logger/create.js')

/**
 * @param {Error} err
 * @param {import('discord.js').Message} message
 */
async function handlePaginationError (err, message) {
  const log = createLogger(message.client.shard.ids[0])
  const newEmbed = new MessageEmbed(message.embeds[0])
    .setFooter(`Failed to enable pagination via message reactions (${err.message})`)
  try {
    await message.edit(message.content, newEmbed)
  } catch (err) {
    log.warn({
      error: err,
      guild: message.guild
    }, 'Pagination controls error')
  }
}

module.exports = handlePaginationError

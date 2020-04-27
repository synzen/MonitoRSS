const FLAGS = require('discord.js').Permissions.FLAGS
const getConfig = require('../../../../config.js').get

/**
 * @param {import('discord.js').TextChannel} channel
 * @param {import('discord.js').Message[]} messages
 */
async function deleteMessages (channel, messages) {
  const { guild } = channel
  const permissions = channel.permissionsFor(guild.me)
  const config = getConfig()
  if (!config.bot.deleteMenus || !permissions.has(FLAGS.MANAGE_MESSAGES)) {
    return
  }
  const inBetween = messages.slice(0, messages.length - 1)
  await Promise.all(inBetween.map(m => m.delete()))
}

module.exports = deleteMessages

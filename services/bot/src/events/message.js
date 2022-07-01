const Command = require('../structs/Command.js')
const createLogger = require('../util/logger/create.js')
const config = require('../config')

/**
 * Handle discord messages from ws
 * @param {import('discord.js').Message} message - Discord message
 */
async function handler (message) {
  const { guild, author, channel, client, member } = message
  const log = createLogger(client.shard.ids[0], {
    message,
    guild,
    channel,
    user: author
  })
  if (Command.shouldIgnore(message, log)) {
    return
  }
  // Check command validity
  const command = Command.tryGetCommand(message, log)
  if (!command) {
    return log.trace('No valid command found')
  }
  try {
    // Check member
    const memberPerms = command.getMemberPermission()
    log.debug({
      requiredPerms: Command.getPermissionNames(memberPerms)
    }, 'Checking member permissions')
    const hasMemberPermission = command.hasMemberPermission(message)
    if (!hasMemberPermission) {
      const missingPerms = command.getMissingChannelPermissions(memberPerms, member, channel)
      const requiredPerms = await command.notifyMissingMemberPerms(message, missingPerms)
      return log.info(`Member permissions ${requiredPerms} missing for command ${command.name}`)
    }
    // If commands are disabled, ignore if it's not an owner
    if (!Command.enabled && !Command.isOwnerID(author.id)) {
      return log.info(`Command ${command.name} disabled, only owners allowed`)
    }

    if (!Command.isOwnerID(author.id) && await Command.blockIfNotSupporter(message)) {
      const visitUrl = config.get().apis.pledge.url.replace('/api', '')
      return await message.channel.send(
        `Sorry, only supporters have access to this bot. To become a supporter, visit ${visitUrl}`
      )
    }

    // Check bot
    const botPerms = command.getBotPermissions()
    log.debug({
      requiredPerms: Command.getPermissionNames(botPerms)
    }, 'Checking bot permissions')
    const hasBotPermission = command.hasBotPermission(message)
    if (!hasBotPermission) {
      const missingPerms = command.getMissingChannelPermissions(botPerms, guild.me, channel)
      const requiredPerms = await command.notifyMissingBotPerms(message, missingPerms)
      return log.info(`Bot permissions ${requiredPerms} missing for command ${command.name}`)
    }
    // Run
    log.info(`Used ${command.name}`)
    await command.run(message)
  } catch (err) {
    if (err.code !== 50013) {
      log.error(err, 'Message listener error (not 50013)')
      message.channel.send(err.message)
        .catch(err => log.error(err, 'Failed to send error message to channel'))
    } else {
      log.warn(err, 'Message listener (50013 permission error)')
    }
  }
}

module.exports = handler

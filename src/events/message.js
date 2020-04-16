const Command = require('../structs/Command.js')
const createLogger = require('../util/logger/create.js')

/**
 * Handle discord messages from ws
 * @param {import('discord.js').Message} message - Discord message
 */
async function handler (message) {
  const { guild, author, channel, client } = message
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
    return log.debug('No valid command found')
  }
  try {
    // Check member
    log.debug({
      requiredPerms: Command.getPermissionNames(command.getMemberPermission())
    }, 'Checking member permissions')
    const hasMemberPermission = await command.hasMemberPermission(message)
    if (!hasMemberPermission) {
      const requiredPerms = await command.notifyMissingMemberPerms(message)
      return log.debug(`Member permissions missing: ${requiredPerms}, commands enabled: ${Command.enabled}`)
    }
    // Check bot
    log.debug({
      requiredPerms: Command.getPermissionNames(command.getBotPermissions())
    }, 'Checking bot permissions')
    const hasBotPermission = command.hasBotPermission(message)
    if (!hasBotPermission) {
      const requiredPerms = await command.notifyMissingBotPerms(message)
      return log.debug(`Bot permissions missing: ${requiredPerms}`)
    }
    log.debug(`Running command ${command.name}`)
    // Run
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

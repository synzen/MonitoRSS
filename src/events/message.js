const commands = require('../util/commands.js')
const channelTracker = require('../util/channelTracker.js')
const storage = require('../util/storage.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

/**
 * Handle discord messages from ws
 * @param {import('discord.js').Message} message - Discord message
 * @param {import('../structs/BlacklistCache.js')} blacklistCache - Blacklisted users and guilds
 */
function handler (message, blacklistCache) {
  const { guild, author, channel, content } = message
  const log = createLogger(message.guild.shard.id, {
    message,
    guild,
    channel,
    user: author
  })
  if (author.bot || !guild || blacklistCache.guilds.has(guild.id) || blacklistCache.users.has(author.id)) {
    log.debug(`Ignored message. One or more conditions are true - author bot:${!!author.bot}, no guild:${!guild}, blacklisted guild:${blacklistCache.guilds.has(guild.id)}, blacklisted user: ${blacklistCache.users.has(author.id)}`)
    return
  }

  const config = getConfig()
  const command = content.split(' ')[0].substr(config.bot.prefix.length)
  if (command === 'forceexit') {
    // Forcibly clear a channel of active menus
    return require('../commands/forceexit.js')(message)
  }

  if (channelTracker.hasActiveMenus(channel.id)) {
    log.debug('Ignored message - channel has active menus')
    return
  }

  // Regular commands
  const ownerIDs = config.bot.ownerIDs
  const onlyOwner = config.bot.enableCommands !== true || config.dev === true
  if (commands.has(message)) {
    if (storage.initialized < 2) {
      log.debug(`Bot is currently booting up, ignoring all commands. Current stage is ${storage.initialized}`)
      return channel.send('This command is disabled while booting up, please wait.')
        .then(m => m.delete({ timeout: 4000 }))
    }
    log.debug('Understood command, checking if user has access to use commands')
    if (!onlyOwner || ownerIDs.includes(author.id)) {
      log.debug(`Permission granted to proceed with command. Only owners allowed: ${onlyOwner}, is owner: ${ownerIDs.includes(author.id)}`)
      return commands.run(message, log)
    }
  }

  // Bot owner commands
  if (ownerIDs.includes(author.id)) {
    commands.runOwner(message, log)
  }
}

module.exports = handler

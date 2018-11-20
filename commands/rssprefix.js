const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const config = require('../config.js')
const dbOps = require('../util/dbOps.js')

module.exports = async (bot, message) => {
  const prefix = message.content.split(' ')[1]
  try {
    if (!prefix) return await message.channel.send('You must specify a prefix 4 characters or less as the first argument to set a custom prefix, or `reset` to reset the prefix to default if a custom prefix is already set.')
    let guildRss = currentGuilds.get(message.guild.id)

    // Reset
    if (prefix === 'reset') {
      if (!guildRss || !guildRss.prefix) return await message.channel.send('You have no custom prefix to reset.')
      delete guildRss.prefix
      return await message.channel.send(`Commands prefix has been reset back to the default (${config.bot.prefix}).`)
    }
    if (prefix.length > 4) return await message.channel.send('Commands prefix length must be less than 5 characters.')
    if (config.prefix === prefix) return await message.channel.send(`Cannot use this commands prefix because it is already the default prefix.`)

    if (!guildRss) guildRss = { id: message.guild.id, name: message.guild.name, prefix: prefix }
    else guildRss.prefix = prefix

    await dbOps.guildRss.update(guildRss, true)
    await message.channel.send(`Successfully changed commands prefix to "${prefix}".`)
  } catch (err) {
    log.command.warning(`rssprefix`, message.guild, err, true)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssprefix 1', message.guild, err))
  }
}

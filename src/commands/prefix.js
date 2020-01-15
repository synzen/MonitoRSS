const log = require('../util/logger.js')
const config = require('../config.js')
const storage = require('../util/storage.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')

module.exports = async (bot, message) => {
  const prefix = message.content.split(' ')[1]
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)

    if (!prefix) {
      return await message.channel.send(translate('commands.prefix.helpText'))
    }
    // Reset
    if (prefix === 'reset') {
      if (!profile || !profile.prefix) {
        return await message.channel.send(translate('commands.prefix.resetNone'))
      }
      profile.prefix = undefined
      delete storage.prefixes[profile.id]
      await profile.save()
      return await message.channel.send(translate('commands.prefix.resetSuccess', { prefix: config.bot.prefix }))
    }
    if (prefix.length > 4) {
      return await message.channel.send(translate('commands.prefix.mustBeLess'))
    }
    if (config.bot.prefix === prefix) {
      return await message.channel.send(translate('commands.prefix.cannotUseDefault'))
    }

    if (!profile) {
      const data = {
        _id: message.guild.id,
        name: message.guild.name,
        prefix
      }
      const newProfile = new GuildProfile(data)
      await newProfile.save()
    } else {
      profile.prefix = prefix
      await profile.save()
    }

    await message.channel.send(translate('commands.prefix.setSuccess', { prefix }))
    storage.prefixes[profile.id] = prefix
  } catch (err) {
    log.command.warning(`rssprefix`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssprefix 1', message.guild, err))
  }
}

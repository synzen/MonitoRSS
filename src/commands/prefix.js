const storage = require('../util/storage.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

module.exports = async (message) => {
  const prefix = message.content.split(' ')[1]
  const profile = await Profile.get(message.guild.id)
  const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)

  if (!prefix) {
    return message.channel.send(translate('commands.prefix.helpText'))
  }

  // Reset
  const config = getConfig()
  if (prefix === 'reset') {
    if (!profile || !profile.prefix) {
      return message.channel.send(translate('commands.prefix.resetNone'))
    }
    profile.prefix = undefined
    delete storage.prefixes[profile.id]
    await profile.save()
    return message.channel.send(translate('commands.prefix.resetSuccess', { prefix: config.bot.prefix }))
  }
  if (prefix.length > 4) {
    return message.channel.send(translate('commands.prefix.mustBeLess'))
  }
  if (config.bot.prefix === prefix) {
    return message.channel.send(translate('commands.prefix.cannotUseDefault'))
  }

  if (!profile) {
    const data = {
      _id: message.guild.id,
      name: message.guild.name,
      prefix
    }
    const newProfile = new Profile(data)
    await newProfile.save()
  } else {
    profile.prefix = prefix
    await profile.save()
  }

  const log = createLogger(message.guild.shard.id)
  log.info({
    guild: message.guild
  }, `Guild prefix updated to ${prefix}`)

  await message.channel.send(translate('commands.prefix.setSuccess', { prefix }))
  storage.prefixes[profile.id] = prefix
}

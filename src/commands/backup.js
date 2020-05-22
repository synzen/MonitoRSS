const GuildData = require('../structs/GuildData.js')
const Attachment = require('discord.js').MessageAttachment
const Translator = require('../structs/Translator.js')

module.exports = async (message, automatic) => { // automatic indicates invokation by the bot
  const guildId = message.guild.id
  const guildData = await GuildData.get(guildId)
  const locale = guildData.profile ? guildData.profile.locale : undefined
  const translate = Translator.createLocaleTranslator(locale)
  if (guildData.isEmpty() && !automatic) {
    return message.channel.send(translate('commands.backup.noProfile'))
  }
  if (message.guild.me.permissionsIn(message.channel).has('ATTACH_FILES')) {
    const data = Buffer.from(JSON.stringify(guildData.toJSON(), null, 2))
    const attachment = new Attachment(data, guildId + '.json')
    await message.channel.send(attachment)
  } else {
    await message.channel.send(translate('commands.backup.noPermission'))
  }
}

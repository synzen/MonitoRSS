const Profile = require('../structs/db/Profile.js')
const Translator = require('../structs/Translator.js')

module.exports = async (message, automatic) => { // automatic indicates invokation by the bot
  const profile = await Profile.get(message.guild.id)
  await message.channel.send(Translator.translate('commands.invite.text', profile ? profile.locale : undefined, {
    id: message.client.user.id
  }))
}

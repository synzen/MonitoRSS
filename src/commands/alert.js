const log = require('../util/logger.js')
const config = require('../config.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  try {
    let [ profile, feeds ] = await Promise.all([
      Profile.get(message.guild.id),
      Feed.getManyBy('guild', message.guild.id)
    ])
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
    if (feeds.length === 0) {
      return await message.channel.send(Translator.translate('commands.alert.noFeeds'))
    }
    const contentArray = message.content.split(' ').map(item => item.trim())
    const guildID = message.guild.id
    const guildName = message.guild.name
    const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
    if (!profile) {
      profile = new Profile({
        _id: guildID,
        name: guildName
      })
    }
    switch (contentArray[1]) {
      case 'add':
      case 'remove':
        if (!contentArray[2]) {
          return await message.channel.send(translate('commands.alert.info', { prefix }))
        }
        const userMention = message.mentions.users.first()
        const member = userMention || await message.guild.members.get(contentArray[2] === 'me' ? message.author.id : contentArray[2])
        if (!member) return await message.channel.send(translate('commands.alert.notFound', { user: userMention || `\`${contentArray[2]}\`` }))
        if (contentArray[1] === 'add') {
          if (profile.alert.includes(member.id)) {
            return await message.channel.send(translate('commands.alert.alreadyEnabled'))
          }
          profile.alert.push(member.id)
          log.command.info(`Added user to alerts`, message.guild, userMention || member.user)
          await member.send(translate('commands.alert.successDM', { member, guildName, guildID }))
          await message.channel.send(translate('commands.alert.success', { member }))
        } else {
          const removeIndex = profile.alert.indexOf(member.id)
          if (removeIndex === -1) {
            return await message.channel.send(translate('commands.alert.removeFail'))
          }
          profile.alert.splice(removeIndex, 1)
          log.command.info(`Removed user from alerts`, message.guild, userMention || member.user)
          await member.send(translate('commands.alert.removedDM', { member, guildName, guildID }))
          await message.channel.send(translate('commands.alert.removed', { member }))
        }
        await profile.save()
        break
      case 'list':
        if (profile.alert.length === 0) {
          return await message.channel.send(translate('commands.alert.listEmpty'))
        }
        let msg = translate('commands.alert.list')
        for (const id of profile.alert) {
          msg += `${await message.guild.members.get(id)}\n`
        }
        await message.channel.send(msg)
        break
      default:
        return await message.channel.send(translate('commands.alert.info', { prefix }))
    }
  } catch (err) {
    log.command.warning('rssalert', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssalert 1', message.guild, err))
  }
}

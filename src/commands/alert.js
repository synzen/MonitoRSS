const getConfig = require('../config.js').get
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const createLogger = require('../util/logger/create.js')

module.exports = async (message, automatic) => { // automatic indicates invokation by the bot
  let [profile, feeds] = await Promise.all([
    Profile.get(message.guild.id),
    Feed.getManyBy('guild', message.guild.id)
  ])
  const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
  if (feeds.length === 0) {
    return message.channel.send(Translator.translate('commands.alert.noFeeds'))
  }
  const contentArray = message.content.split(' ').map(item => item.trim())
  const guildID = message.guild.id
  const guildName = message.guild.name
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  if (!profile) {
    profile = new Profile({
      _id: guildID,
      name: guildName
    })
  }
  const log = createLogger(message.guild.shard.id)
  switch (contentArray[1]) {
    case 'add':
    case 'remove': {
      const target = contentArray[2]
      if (!target) {
        return message.channel.send(translate('commands.alert.info', { prefix }))
      }
      if (target === '@everyone' || target === '@here') {
        return message.channel.send(translate('commands.alert.everyoneNotAllowed'))
      }
      const userMention = message.mentions.users.first()
      const member = userMention || await message.guild.members.fetch(target === 'me'
        ? message.author.id
        : target)
      if (!member) {
        return message.channel.send(translate('commands.alert.notFound', {
          user: userMention || `\`${target}\``
        }))
      }
      if (contentArray[1] === 'add') {
        // Add
        if (profile.alert.includes(member.id)) {
          return message.channel.send(translate('commands.alert.alreadyEnabled'))
        }
        profile.alert.push(member.id)
        log.info({
          guild: message.guild
        }, 'Added user to alerts', message.guild, userMention || member.user)
        await member.send(translate('commands.alert.successDM', { member, guildName, guildID }))
        await message.channel.send(translate('commands.alert.success', { member }))
      } else {
        // Remove
        const removeIndex = profile.alert.indexOf(member.id)
        if (removeIndex === -1) {
          return message.channel.send(translate('commands.alert.removeFail'))
        }
        profile.alert.splice(removeIndex, 1)
        log.info({
          guild: message.guild
        }, 'Removed user from alerts', message.guild, userMention || member.user)
        await member.send(translate('commands.alert.removedDM', { member, guildName, guildID }))
        await message.channel.send(translate('commands.alert.removed', { member }))
      }
      await profile.save()
      break
    }
    case 'list': {
      if (profile.alert.length === 0) {
        return message.channel.send(translate('commands.alert.listEmpty'))
      }
      let msg = translate('commands.alert.list')
      for (const id of profile.alert) {
        try {
          const member = await message.guild.members.fetch(id)
          msg += `${member}\n`
        } catch (err) {
          log.warn({
            id,
            error: err
          }, 'Failed to fetch member')
          msg += `${id} (Unknown member)\n`
        }
      }
      await message.channel.send(msg)
      break
    }
    default:
      return message.channel.send(translate('commands.alert.info', { prefix }))
  }
}

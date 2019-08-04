const log = require('../util/logger.js')
const config = require('../config.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const translate = Translator.createLocaleTranslator(guildRss ? guildRss.locale : undefined)
    if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) return await message.channel.send(Translator.translate('commands.rssalert.noFeeds'))
    const contentArray = message.content.split(' ').map(item => item.trim())
    const guildID = guildRss.id
    const guildName = guildRss.name
    const prefix = guildRss.prefix || config.bot.prefix
    switch (contentArray[1]) {
      case 'add':
      case 'remove':
        if (!contentArray[2]) return await message.channel.send(translate('commands.rssalert.info', { prefix }))
        const userMention = message.mentions.users.first()
        const member = userMention || await message.guild.members.get(contentArray[2] === 'me' ? message.author.id : contentArray[2])
        if (!member) return await message.channel.send(translate('commands.rssalert.notFound', { user: userMention || `\`${contentArray[2]}\`` }))
        if (contentArray[1] === 'add') {
          if (!Array.isArray(guildRss.sendAlertsTo)) guildRss.sendAlertsTo = [ member.id ]
          else {
            if (guildRss.sendAlertsTo.includes(member.id)) return await message.channel.send(translate('commands.rssalert.alreadyEnabled'))
            guildRss.sendAlertsTo.push(member.id)
          }
          log.command.info(`Added user to alerts`, message.guild, userMention || member.user)
          await member.send(translate('commands.rssalert.successDM', { member, guildName, guildID }))
          await message.channel.send(translate('commands.rssalert.success', { member }))
        } else {
          if (Array.isArray(guildRss.sendAlertsTo)) {
            const removeIndex = guildRss.sendAlertsTo.indexOf(member.id)
            if (removeIndex === -1) return await message.channel.send(translate('commands.rssalert.removeFail'))
            guildRss.sendAlertsTo.splice(removeIndex, 1)
            if (guildRss.sendAlertsTo.length === 0) guildRss.sendAlertsTo = undefined
            log.command.info(`Removed user from alerts`, message.guild, userMention || member.user)
            await member.send(translate('commands.rssalert.removedDM', { member, guildName, guildID }))
            await message.channel.send(translate('commands.rssalert.removed', { member }))
          } else return await message.channel.send(translate('commands.rssalert.removeFail'))
        }
        await dbOpsGuilds.update(guildRss, true)
        break
      case 'list':
        if (!Array.isArray(guildRss.sendAlertsTo) || guildRss.sendAlertsTo.length === 0) return await message.channel.send(translate('commands.rssalert.listEmpty'))
        let msg = translate('commands.rssalert.list')
        for (const id of guildRss.sendAlertsTo) {
          msg += `${await message.guild.members.get(id)}\n`
        }
        await message.channel.send(msg)
        break
      default:
        return await message.channel.send(translate('commands.rssalert.info', { prefix }))
    }
  } catch (err) {
    log.command.warning('rssalert', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssalert 1', message.guild, err))
  }
}

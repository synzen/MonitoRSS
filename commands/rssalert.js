const log = require('../util/logger.js')
const config = require('../config.js')
const dbOps = require('../util/dbOps.js')
const explanation = guildRss => `This command adds users for direct messaging (instead of posting such alerts to the feed's channel by default) when there are any warnings or alerts concerning feeds, such as feed limit changes or feed failures. **The user you're adding or removing will be notified.** The correct syntaxes are:\n\n\`${guildRss.prefix || config.bot.prefix}rssalert add <user id/mention>\` - Add a user to alerted.\n\`${guildRss.prefix || config.bot.prefix}rssalert remove <user id/mention>\` - Remove a user currently receiving alerts\n\`${guildRss.prefix || config.bot.prefix}rssalert list\` - Show all users currently receiving alerts`

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  try {
    const guildRss = await dbOps.guildRss.get(message.guild.id)
    if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) return await message.channel.send('You cannot set up user alerts if you have not added any feeds.')
    const contentArray = message.content.split(' ').map(item => item.trim())

    switch (contentArray[1]) {
      case 'add':
      case 'remove':
        if (!contentArray[2]) return await message.channel.send(explanation(guildRss))
        const userMention = message.mentions.users.first()
        const member = userMention || await message.guild.members.get(contentArray[2] === 'me' ? message.author.id : contentArray[2])
        if (!member) return await message.channel.send(`The user ${userMention || `with ID \`${contentArray[2]}\``} was not found in this server.`)
        if (contentArray[1] === 'add') {
          if (!Array.isArray(guildRss.sendAlertsTo)) guildRss.sendAlertsTo = [ member.id ]
          else {
            if (guildRss.sendAlertsTo.includes(member.id)) return await message.channel.send(`That user is already enabled for direct messaging feed warnings/failures in this server.`)
            guildRss.sendAlertsTo.push(member.id)
          }
          log.command.info(`Added user to alerts`, message.guild, userMention || member.user)
          await member.send(`At the request of ${member}, you will now be notified of any warnings/failures of feeds in the server \`${guildRss.name}\` (ID \`${guildRss.id}\`).`)
          await message.channel.send(`Successfully enabled user ${member} for direct messaging feed warnings/failures. The user has been notified of this change.`)
        } else {
          if (Array.isArray(guildRss.sendAlertsTo)) {
            const removeIndex = guildRss.sendAlertsTo.indexOf(member.id)
            if (removeIndex === -1) return await message.channel.send('You cannot remove a user that is not currently enabled for feed warning/failure direct messaging alerts.')
            guildRss.sendAlertsTo.splice(removeIndex, 1)
            if (guildRss.sendAlertsTo.length === 0) guildRss.sendAlertsTo = undefined
            log.command.info(`Removed user from alerts`, message.guild, userMention || member.user)
            await member.send(`At the request of ${member}, you will no longer be notified of any warnings or failures of feeds in the server \`${guildRss.name}\` (ID \`${guildRss.id}\`).`)
            await message.channel.send(`Successfully removed user ${member} from direct messaging feed warnings/failures. The user has been notified of this change.`)
          } else return await message.channel.send('You cannot remove a user that is not currently enabled for feed warning/failure direct messaging alerts.')
        }
        await dbOps.guildRss.update(guildRss, true)
        break
      case 'list':
        if (!Array.isArray(guildRss.sendAlertsTo) || guildRss.sendAlertsTo.length === 0) return await message.channel.send(`There are currently no users that will be notified through direct messaging when there are feed warnings/failures in this server.`)
        let msg = `The current list of users below will be notified through direct messaging when there are feed warnings/failures in this server:\n\n`
        for (const id of guildRss.sendAlertsTo) {
          msg += `${await message.guild.members.get(id)}\n`
        }
        await message.channel.send(msg)
        break
      default:
        return await message.channel.send(explanation(guildRss))
    }
  } catch (err) {
    log.command.warning('rssalert', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssalert 1', message.guild, err))
  }
}

const getSubList = require('./util/getSubList.js')
const dbOps = require('../util/dbOps.js')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const config = require('../config.js')

function removeRole (message, role) {
  message.member.removeRole(role)
    .then(mem => {
      log.command.info(`Removed role from member`, message.guild, role, message.author)
      message.channel.send(`You no longer have the role \`${role.name}\`.`)
    })
    .catch(err => {
      message.channel.send(`Error: Unable to remove role.` + err.message ? ` (${err.message})` : '')
      log.command.warning(`Unable to remove role`, message.guild, role, message.author, err)
    })
}

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOps.guildRss.get(message.guild.id)
    const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
    const botRole = message.guild.members.get(bot.user.id).highestRole
    const memberRoles = message.member.roles

    // Get an array of eligible roles that is lower than the bot's role, and is not @everyone by filtering it
    const filteredMemberRoles = Array.from(memberRoles.filter(role => role.comparePositionTo(botRole) < 0 && role.name !== '@everyone').values())

    const eligibleRoles = []
    for (var a in filteredMemberRoles) eligibleRoles.push(filteredMemberRoles[a].name.toLowerCase())

    if (filteredMemberRoles.length === 0) return await message.channel.send('There are no eligible roles to be removed from you.')

    const msgArr = message.content.split(' ')
    msgArr.shift()
    const mention = message.mentions.roles.first()
    const predeclared = msgArr.join(' ').trim()
    if (predeclared) {
      const role = message.guild.roles.find(r => r.name.toLowerCase() === predeclared.toLowerCase())
      if (role && eligibleRoles.includes(predeclared.toLowerCase())) return removeRole(message, role)
      else if (mention && eligibleRoles.includes(mention.name.toLowerCase())) return removeRole(message, mention)
      return await message.channel.send(`That is not a valid role to remove. To see the the full list of roles that can be removed, type \`${config.bot.prefix}unsubme\`.`)
    }

    const ask = new MenuUtils.Menu(message, null, { numbered: false })
      .setTitle('Self-Subscription Removal')
      .setDescription(`Below is the list of feeds, their channels, and its eligible roles that you may remove yourself from. Type the role name after **${config.bot.prefix}unsubme** to remove a role from yourself.\u200b\n\u200b\n`)

    // Generate a list of feeds and eligible roles to be removed
    const options = getSubList(message.guild, rssList)
    if (!options) return await message.channel.send('There are no eligible roles to be removed from you.')
    let userHasRoles = false
    for (const subscriptionData of options) {
      const temp = []
      for (let i = filteredMemberRoles.length - 1; i >= 0; --i) {
        const memberRole = filteredMemberRoles[i]
        if (!subscriptionData.roleList.includes(memberRole.id)) continue
        temp.push(memberRole.name)
        filteredMemberRoles.splice(i, 1)
      }
      temp.sort()
      if (temp.length === 0) continue
      const title = subscriptionData.source.title + ` (${temp.length})`
      let channelName = message.guild.channels.get(subscriptionData.source.channel).name
      let desc = `**Link**: ${subscriptionData.source.link}\n**Channel**: #${channelName}\n**Roles**:\n`
      for (var x = 0; x < temp.length; ++x) {
        const cur = temp[x]
        const next = temp[x + 1]
        desc += `${cur}\n`
        // If there are too many roles, add it into another field
        if (desc.length < 1024 && next && (`${next}\n`.length + desc.length) >= 1024) {
          ask.addOption(title, desc, true)
          desc = ``
        }
      }
      ask.addOption(title, desc, true)
      userHasRoles = true
    }

    if (!userHasRoles) return await message.channel.send('There are no eligible roles to be removed from you.')

    // Some roles may not have a feed assigned since it prints all roles below the bot's role.
    if (filteredMemberRoles.length > 0) {
      const temp = []

      for (var leftoverRole in filteredMemberRoles) temp.push(filteredMemberRoles[leftoverRole].name)
      temp.sort()
      const title = `Other Roles${temp.length > 0 ? ` (${temp.length})` : ``}`
      let desc = ''
      for (var y = 0; y < temp.length; ++y) {
        const cur = temp[y]
        const next = temp[y + 1]
        desc += `${cur}\n`
        // If there are too many roles, add it into another field
        if (desc.length < 1024 && next && (`${next}\n`.length + desc.length) >= 1024) {
          ask.addOption(title, desc, true)
          desc = ''
        }
      }
      ask.addOption(`Other Roles`, desc, true)
    }

    ask.send().catch(err => {
      log.command.warning(`unsubme 2`, message.guild, err)
      if (err.code !== 50013) message.channel.send(err.message)
    })
  } catch (err) {
    log.command.warning('unsubme', message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('unsubme 1', message.guild, err))
  }
}

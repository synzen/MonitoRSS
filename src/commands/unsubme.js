const config = require('../config.js')
const getSubList = require('./util/getSubList.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const Translator = require('../structs/Translator.js')

function removeRole (message, role, translate) {
  message.member.removeRole(role)
    .then(mem => {
      log.command.info(`Removed role from member`, message.guild, role, message.author)
      message.channel.send(translate('commmands.unsubme.success', { name: role.name }))
    })
    .catch(err => {
      message.channel.send(translate('commands.unsubme.removeFailed') + err.message ? ` (${err.message})` : '')
      log.command.warning(`Unable to remove role`, message.guild, role, message.author, err)
    })
}

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const translate = Translator.createLocaleTranslator(guildRss ? guildRss.locale : undefined)
    const prefix = guildRss && guildRss.prefix ? guildRss.prefix : config.bot.prefix
    const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
    const botRole = message.guild.members.get(bot.user.id).highestRole
    const memberRoles = message.member.roles

    // Get an array of eligible roles that is lower than the bot's role, and is not @everyone by filtering it
    const filteredMemberRoles = Array.from(memberRoles.filter(role => role.comparePositionTo(botRole) < 0 && role.name !== '@everyone').values())

    const eligibleRoles = []
    for (var a in filteredMemberRoles) {
      eligibleRoles.push(filteredMemberRoles[a].name.toLowerCase())
    }

    if (filteredMemberRoles.length === 0) {
      return await message.channel.send(translate('commands.unsubme.noEligible'))
    }

    const msgArr = message.content.split(' ')
    msgArr.shift()
    const mention = message.mentions.roles.first()
    const predeclared = msgArr.join(' ').trim()
    if (predeclared) {
      const role = message.guild.roles.find(r => r.name.toLowerCase() === predeclared.toLowerCase())
      if (role && eligibleRoles.includes(predeclared.toLowerCase())) return removeRole(message, role, translate)
      else if (mention && eligibleRoles.includes(mention.name.toLowerCase())) return removeRole(message, mention, translate)
      return await message.channel.send(translate('commands.unsubme.invalidRole'))
    }

    const ask = new MenuUtils.Menu(message, null, { numbered: false })
      .setTitle(translate('commands.unsubme.selfSubscriptionRemoval'))
      .setDescription(translate('commands.unsubme.listDescription', { prefix }))

    // Generate a list of feeds and eligible roles to be removed
    const options = getSubList(message.guild, rssList)
    if (!options) {
      return await message.channel.send(translate('commands.unsubme.noEligible'))
    }
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
      let desc = `**${translate('commands.subme.link')}**: ${subscriptionData.source.link}\n**${translate('commands.subme.channel')}**: #${channelName}\n**${translate('commands.subme.roles')}**:\n`
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

    if (!userHasRoles) {
      return await message.channel.send(translate('commands.unsubme.noEligible'))
    }

    // Some roles may not have a feed assigned since it prints all roles below the bot's role.
    if (filteredMemberRoles.length > 0) {
      const temp = []

      for (const leftoverRole in filteredMemberRoles) {
        temp.push(filteredMemberRoles[leftoverRole].name)
      }
      temp.sort()
      const title = `${translate('commands.unsubme.otherRoles')}${temp.length > 0 ? ` (${temp.length})` : ``}`
      let desc = ''
      for (let y = 0; y < temp.length; ++y) {
        const cur = temp[y]
        const next = temp[y + 1]
        desc += `${cur}\n`
        // If there are too many roles, add it into another field
        if (desc.length < 1024 && next && (`${next}\n`.length + desc.length) >= 1024) {
          ask.addOption(title, desc, true)
          desc = ''
        }
      }
      ask.addOption(translate('commands.unsubme.otherRoles'), desc, true)
    }

    await ask.send()
  } catch (err) {
    log.command.warning('unsubme', message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('unsubme 1', message.guild, err))
  }
}

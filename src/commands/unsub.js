const config = require('../config.js')
const getSubList = require('./util/getSubList.js')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')

function removeRole (message, role, translate) {
  message.member.roles.remove(role)
    .then(mem => {
      log.command.info(`Removed role from member`, message.guild, role, message.author)
      message.channel.send(translate('commands.unsub.removeSuccess', { name: role.name }))
    })
    .catch(err => {
      message.channel.send(translate('commands.unsub.removeFailed') + err.message ? ` (${err.message})` : '')
      log.command.warning(`Unable to remove role`, message.guild, role, message.author, err)
    })
}

module.exports = async (bot, message, command) => {
  try {
    const profile = await Profile.get(message.guild.id)
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
    const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const botRole = message.guild.members.cache.get(bot.user.id).roles.highest
    const memberRoles = message.member.roles.cache

    // Get an array of eligible roles that is lower than the bot's role, and is not @everyone by filtering it
    const filteredMemberRoles = Array.from(memberRoles.filter(role => role.comparePositionTo(botRole) < 0 && role.name !== '@everyone').values())

    const eligibleRoles = []
    for (var a in filteredMemberRoles) {
      eligibleRoles.push(filteredMemberRoles[a].name.toLowerCase())
    }

    if (filteredMemberRoles.length === 0) {
      return await message.channel.send(translate('commands.unsub.noEligible'))
    }

    const msgArr = message.content.split(' ')
    msgArr.shift()
    const mention = message.mentions.roles.first()
    const predeclared = msgArr.join(' ').trim()
    if (predeclared) {
      const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === predeclared.toLowerCase())
      if (role && eligibleRoles.includes(predeclared.toLowerCase())) {
        return removeRole(message, role, translate)
      } else if (mention && eligibleRoles.includes(mention.name.toLowerCase())) {
        return removeRole(message, mention, translate)
      }
      return await message.channel.send(translate('commands.unsub.invalidRole'))
    }

    const ask = new MenuUtils.Menu(message, null, { numbered: false })
      .setTitle(translate('commands.unsub.selfSubscriptionRemoval'))
      .setDescription(translate('commands.unsub.listDescription', { prefix }))

    // Generate a list of feeds and eligible roles to be removed
    const options = await getSubList(message.guild, feeds)
    if (!options) {
      return await message.channel.send(translate('commands.unsub.noEligible'))
    }
    let userHasRoles = false
    for (const subscriptionData of options) {
      const temp = []
      for (let i = filteredMemberRoles.length - 1; i >= 0; --i) {
        const memberRole = filteredMemberRoles[i]
        if (!subscriptionData.roleList.includes(memberRole.id)) {
          continue
        }
        temp.push(memberRole.name)
        filteredMemberRoles.splice(i, 1)
      }
      temp.sort()
      if (temp.length === 0) {
        continue
      }
      const title = subscriptionData.source.title + ` (${temp.length})`
      let channelName = message.guild.channels.cache.get(subscriptionData.source.channel).name
      let desc = `**${translate('commands.sub.link')}**: ${subscriptionData.source.url}\n**${translate('commands.sub.channel')}**: #${channelName}\n**${translate('commands.sub.roles')}**:\n`
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
      return await message.channel.send(translate('commands.unsub.noEligible'))
    }

    // Some roles may not have a feed assigned since it prints all roles below the bot's role.
    if (filteredMemberRoles.length > 0) {
      const temp = []

      for (const leftoverRole in filteredMemberRoles) {
        temp.push(filteredMemberRoles[leftoverRole].name)
      }
      temp.sort()
      const title = `${translate('commands.unsub.otherRoles')}${temp.length > 0 ? ` (${temp.length})` : ``}`
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
      ask.addOption(translate('commands.unsub.otherRoles'), desc, true)
    }

    await ask.send()
  } catch (err) {
    log.command.warning('unsub', message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('unsub 1', message.guild, err))
  }
}

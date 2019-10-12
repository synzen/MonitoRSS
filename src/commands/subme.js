const config = require('../config.js')
const getSubList = require('./util/getSubList.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const MenuUtils = require('../structs/MenuUtils.js')
const Translator = require('../structs/Translator.js')
const log = require('../util/logger.js')

function addRole (message, role, links, translate) {
  message.member.addRole(role)
    .then(mem => {
      message.channel.send(translate('commands.subme.addSuccess', { name: role.name, links: links.join('>\n<') }), { split: true }).catch(err => log.command.warning('subme addrole 1', err))
      log.command.info(`Role successfully added to member`, message.guild, role, message.author)
    })
    .catch(err => {
      message.channel.send(translate('commands.subme.addFailed') + err.message ? ` (${err.message})` : '', { split: true }).catch(err => log.comamnd.warning('subme addrole 2', err))
      log.command.warning(`Unable to add role to user`, message.guild, role, message.author, err)
    })
}

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const translate = Translator.createLocaleTranslator(guildRss ? guildRss.locale : undefined)
    if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) {
      return await message.channel.send(translate('commands.subme.noFeeds'))
    }
    const prefix = guildRss.prefix || config.bot.prefix
    const rssList = guildRss.sources
    const options = getSubList(message.guild, rssList)
    if (!options) {
      return await message.channel.send(translate('commands.subme.noEligible'))
    }
    const msgArr = message.content.split(' ')
    msgArr.shift()
    const predeclared = msgArr.join(' ').trim()
    if (predeclared) {
      const role = message.guild.roles.find(r => r.name.toLowerCase() === predeclared.toLowerCase()) || message.mentions.roles.first()
      const links = []
      if (role) {
        for (const subscriptionData of options) {
          const roleIds = subscriptionData.roleList
          if (roleIds.includes(role.id)) links.push(subscriptionData.source.link)
        }
      }
      if (links.length > 0 && role) return addRole(message, role, links, translate)
      return await message.channel.send(translate('commands.subme.invalidRole', { prefix }))
    }

    const ask = new MenuUtils.Menu(message, null, { numbered: false })
      .setTitle(translate('commands.subme.selfSubscriptionAddition'))
      .setDescription(translate('commands.subme.listDescription', { prefix }))

    for (const subscriptionData of options) {
      // const roleData = options[option]
      const temp = []
      for (const roleID of subscriptionData.roleList) temp.push(message.guild.roles.get(roleID).name)
      temp.sort()
      const channelName = message.guild.channels.get(subscriptionData.source.channel).name
      const title = subscriptionData.source.title + (temp.length > 0 ? ` (${temp.length})` : '')
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
    }

    await ask.send()
  } catch (err) {
    log.command.warning(`subme`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('subme 1', message.guild, err))
  }
}

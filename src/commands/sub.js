const getSubList = require('./util/getSubList.js')
const MenuUtils = require('../structs/MenuUtils.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

function addRole (message, role, links, translate) {
  const log = createLogger(message.guild.shard.id)
  message.member.roles.add(role)
    .then(mem => {
      message.channel.send(translate('commands.sub.addSuccess', { name: role.name, links: links.join('>\n<') }), { split: true }).catch(err => log.command.warning('subme addrole 1', err))
      log.info({
        guild: message.guild,
        user: message.author,
        role
      }, `Role successfully added to member`)
    })
    .catch(err => {
      message.channel.send(translate('commands.sub.addFailed') + err.message ? ` (${err.message})` : '', { split: true }).catch(err => log.comamnd.warning('subme addrole 2', err))
      log.warn({
        error: err,
        guild: message.guild,
        user: message.author
      }, `Unable to add role to user`)
    })
}

module.exports = async (message, command) => {
  const profile = await Profile.get(message.guild.id)
  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
  if (feeds.length === 0) {
    return message.channel.send(translate('commands.sub.noFeeds'))
  }
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const options = await getSubList(message.guild, feeds)
  if (!options) {
    return message.channel.send(translate('commands.sub.noEligible'))
  }
  const msgArr = message.content.split(' ')
  msgArr.shift()
  const predeclared = msgArr.join(' ').trim()
  if (predeclared) {
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === predeclared.toLowerCase()) || message.mentions.roles.first()
    const links = []
    if (role) {
      for (const subscriptionData of options) {
        const roleIds = subscriptionData.roleList
        if (roleIds.includes(role.id)) links.push(subscriptionData.source.url)
      }
    }
    if (links.length > 0 && role) return addRole(message, role, links, translate)
    return message.channel.send(translate('commands.sub.invalidRole', { prefix }))
  }

  const ask = new MenuUtils.Menu(message, null, { numbered: false })
    .setTitle(translate('commands.sub.selfSubscriptionAddition'))
    .setDescription(translate('commands.sub.listDescription', { prefix }))

  for (const subscriptionData of options) {
    // const roleData = options[option]
    const temp = []
    for (const roleID of subscriptionData.roleList) {
      temp.push(message.guild.roles.cache.get(roleID).name)
    }
    temp.sort()
    const channelName = message.guild.channels.cache.get(subscriptionData.source.channel).name
    const title = subscriptionData.source.title + (temp.length > 0 ? ` (${temp.length})` : '')
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
  }

  await ask.send()
}

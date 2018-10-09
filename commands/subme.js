const getSubList = require('./util/getSubList.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const config = require('../config.json')

function addRole (message, role, links) {
  message.member.addRole(role)
    .then(mem => {
      log.command.info(`Role successfully added to member`, message.guild, role, message.author)
      message.channel.send(`You now have the role \`${role.name}\`, subscribed to:\n\n**<${links.join('>\n a<')}>**`, { split: true }).catch(err => log.command.warning('subme addrole 1', err))
    })
    .catch(err => {
      message.channel.send(`Error: Unable to add role.` + err.message ? ` (${err.message})` : '', { split: true }).catch(err => log.comamnd.warning('subme addrole 2', err))
      log.command.warning(`Unable to add role to user`, message.guild, role, message.author, err)
    })
}

module.exports = async (bot, message, command) => {
  try {
    const guildRss = currentGuilds.get(message.guild.id)
    if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) return await message.channel.send('There are no active feeds to subscribe to.')

    const rssList = guildRss.sources
    const options = getSubList(bot, message.guild, rssList)
    if (!options) return await message.channel.send('There are either no feeds with subscriptions, or no eligible subscribed roles that can be self-added.')
    const mention = message.mentions.roles.first()
    const msgArr = message.content.split(' ')
    msgArr.shift()
    const predeclared = msgArr.join(' ').trim()
    if (predeclared) {
      const role = message.guild.roles.find(r => r.name.toLowerCase() === predeclared.toLowerCase())
      const links = []
      if (role || mention) {
        for (var option in options) {
          const roleData = options[option]
          if (roleData.roleList.includes(role.id)) links.push(roleData.source.link)
        }
      }
      if (links.length > 0 && (role || mention)) return addRole(message, role || mention, links)
      return await message.channel.send(`That is not a valid role to add. To see the the full list of roles that can be added, type \`${config.bot.prefix}subme\`.`)
    }

    const ask = new MenuUtils.Menu(message, null, { numbered: false })
      .setTitle('Self-Subscription Addition')
      .setDescription(`Below is the list of feeds, their channels, and its eligible roles that you may add to yourself. Type the role name after **${config.bot.prefix}subme** to add the role to yourself.\u200b\n\u200b\n`)

    for (let option in options) {
      const roleData = options[option]
      const temp = []
      for (var roleID in roleData.roleList) temp.push(message.guild.roles.get(roleData.roleList[roleID]).name)
      temp.sort()
      const channelName = message.guild.channels.get(roleData.source.channel).name
      const title = roleData.source.title + (temp.length > 0 ? ` (${temp.length})` : '')
      let desc = `**Link**: ${roleData.source.link}\n**Channel**: #${channelName}\n**Roles**:\n`
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

    ask.send().catch(err => {
      log.command.warning(`subme 2`, message.guild, err)
      if (err.code !== 50013) message.channel.send(err.message)
    })
  } catch (err) {
    log.command.warning(`subme`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('subme 1', message.guild, err))
  }
}

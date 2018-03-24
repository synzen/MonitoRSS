const getSubList = require('./util/getSubList.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const MenuUtils = require('./util/MenuUtils.js')
const log = require('../util/logger.js')
const config = require('../config.json')

function selectRole (m, data, callback) {
  const { eligibleRoles } = data
  const input = m.content
  const chosenRole = m.guild.roles.find('name', input)

  if (!chosenRole || !eligibleRoles.includes(input)) return callback(new SyntaxError('That is not a valid role to remove. Try again, or type `exit` to cancel.'))
  callback(null, { ...data, role: chosenRole })
}

async function removeRole (err, data, direct) {
  const { role, message } = data
  try {
    if (err && direct) return await message.channel.send('That is not a valid role to remove.')
    else if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
    message.member.removeRole(role).catch(err => {
      message.channel.send(`Error: Unable to remove role.` + err.message ? ` (${err.message})` : '')
      log.command.warning(`Unable to remove role`, message.guild, role, message.author, err)
    })
    log.command.info(`Removed role from member`, message.guild, role, message.author)
    await message.channel.send(`You no longer have the role \`${role.name}\`.`)
  } catch (err) {
    log.command.warning(`unsubme 3`, message.guild, err)
  }
}

module.exports = async (bot, message, command) => {
  const guildRss = currentGuilds.get(message.guild.id)
  const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
  const botRole = message.guild.members.get(bot.user.id).highestRole
  const memberRoles = message.member.roles

  try {
    // Get an array of eligible roles that is lower than the bot's role, and is not @everyone by filtering it
    const filteredMemberRoles = memberRoles.filterArray(role => role.comparePositionTo(botRole) < 0 && role.name !== '@everyone')

    const eligibleRoles = []
    for (var a in filteredMemberRoles) eligibleRoles.push(filteredMemberRoles[a].name)

    if (filteredMemberRoles.length === 0) return await message.channel.send('There are no eligible roles to be removed from you.')

    const msgArr = message.content.split(' ')
    msgArr.shift()
    const mention = message.mentions.roles.first()
    const predeclared = msgArr.join(' ').trim()
    if (predeclared) {
      const role = message.guild.roles.find('name', predeclared)
      if (role && eligibleRoles.includes(predeclared)) return removeRole(null, { role: role, message: message }, true)
      else if (mention && eligibleRoles.includes(mention.name)) return removeRole(null, { role: mention, message: message }, true)
      return await message.channel.send(`That is not a valid role to remove. To see the the full list of roles that can be added, ype \`${config.bot.prefix}subme\`.`)
    }

    const ask = new MenuUtils.Menu(message, selectRole, { numbered: false })
      .setTitle('Self-Subscription Removal')
      .setDescription('Below is the list of feeds, their channels, and its eligible roles that you may remove yourself from. Type the role name you want removed, or type **exit** to cancel.\u200b\n\u200b\n')

    // Generate a list of feeds and eligible roles to be removed
    const options = getSubList(bot, message.guild, rssList)
    for (var option in options) {
      let roleList = ''
      for (var memberRole in filteredMemberRoles) {
        if (options[option].roleList.includes(filteredMemberRoles[memberRole].id)) {
          roleList += filteredMemberRoles[memberRole].name + '\n'
          filteredMemberRoles.splice(memberRole, 1)
        }
      }
      if (roleList) {
        let channelID = options[option].source.channel
        let channelName = message.guild.channels.get(channelID).name
        // list.addField(options[option].source.title, `**Link**: ${options[option].source.link}\n**Channel:**: #${channelName}\n${roleList}`, true)
        ask.addOption(options[option].source.title, `**Link**: ${options[option].source.link}\n**Channel:**: #${channelName}\n${roleList}`, true)
      }
    }

    // Some roles may not have a feed assigned since it prints all roles below the bot's role.
    if (filteredMemberRoles.length > 0) {
      let leftoverRoles = ''
      for (var leftoverRole in filteredMemberRoles) {
        leftoverRoles += filteredMemberRoles[leftoverRole].name + '\n'
      }
      ask.addOption(`No Feed Assigned`, leftoverRoles, true)
    }

    ask.send({ eligibleRoles: eligibleRoles }, async (err, data) => {
      try {
        if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
        removeRole(err, { ...data, message: message })
      } catch (err) {
        log.command.warning(`unsubme 2`, message.guild, err)
      }
    })
  } catch (err) {
    log.command.warning('unsubme', message.guild, err)
  }
}

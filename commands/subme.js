const getSubList = require('./util/getSubList.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const MenuUtils = require('./util/MenuUtils.js')
const log = require('../util/logger.js')

function verifyRole (m, data, callback) {
  const { options } = data
  const chosenRoleName = m.content
  const chosenRole = m.guild.roles.find('name', chosenRoleName)
  if (!chosenRole) return callback(new SyntaxError('That is not a valid role subscription to add. Try again, or type `exit` to cancel.'))
  const chosenRoleID = chosenRole.id
  let found = false

  for (var option in options) {
    if (options[option].roleList.includes(chosenRoleID)) {
      var source = options[option].source
      found = true
    }
  }

  if (!found) return callback(new SyntaxError('That is not a valid role subscription to add. Try again, or type `exit` to cancel.'))

  if (m.member.roles.get(chosenRole.id)) return callback(new Error(`You already have the role \`${chosenRole.name}\`.`))
  callback(null, { ...data, role: chosenRole, source: source })
}

async function addRole (err, data, direct) {
  const { role, source, message } = data
  try {
    if (err && direct) return await message.channel.send('That is not a valid role subscription to add.')
    else if (err) return err.code === 50013 ? null : await message.channel.send(err.message)

    message.member.addRole(role).catch(err => {
      message.channel.send(`Error: Unable to add role.` + err.message ? ` (${err.message})` : '')
      log.command.warning(`Unable to add role to user`, message.guild, role, message.author, err)
    })
    log.command.info(`Role successfully added to member`, message.guild, role)
    await message.channel.send(`You now have the role \`${role.name}\`, subscribed to **<${source.link}>**.`)
  } catch (err) {
    log.command.warning(`subme 2`, message.guild, err)
  }
}

module.exports = (bot, message, command) => {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) return message.channel.send('There are no active feeds to subscribe to.').catch(err => log.command.warning(`subAdd`, message.guild, err))

  const rssList = guildRss.sources
  const options = getSubList(bot, message.guild, rssList)
  if (!options) return message.channel.send('There are either no feeds with subscriptions, or no eligible subscribed roles that can be self-added.').catch(err => log.command.warning(`subAdd 2`, message.guild, err))
  const msgArr = message.content.split(' ')
  const mention = message.mentions.roles.first()
  if (msgArr.length > 1) {
    msgArr.shift()
    const predeclared = msgArr.join(' ')
    const role = message.guild.roles.find('name', predeclared)
    for (var option in options) {
      if (role && options[option].roleList.includes(role.id)) return addRole(null, { role: role, message: message, source: options[option].source }, true)
      else if (mention && options[option].roleList.includes(mention.id)) return addRole(null, { role: mention, message: message, source: options[option].source }, true)
    }
  }

  const ask = new MenuUtils.Menu(message, verifyRole, { numbered: false })
    .setTitle('Self-Subscription Addition')
    .setDescription('Below is the list of feeds, their channels, and its eligible roles that you may add to yourself. Type the role name you want to be added to, or type **exit** to cancel.\u200b\n\u200b\n')

  for (let option in options) {
    let roleList = '**Roles:**\n'
    for (var roleID in options[option].roleList) {
      let roleName = message.guild.roles.get(options[option].roleList[roleID]).name
      roleList += `${roleName}\n`
    }
    const channelID = options[option].source.channel
    const channelName = message.guild.channels.get(channelID).name
    ask.addOption(options[option].source.title, `**Link**: ${options[option].source.link}\n**Channel:** #${channelName}\n${roleList}`, true)
  }

  ask.send({ options: options }, async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      addRole(null, { ...data, message: message })
    } catch (err) {
      log.command.warning(`subme`, message.guild, err)
    }
  })
}

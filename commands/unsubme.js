const Discord = require('discord.js')
const channelTracker = require('../util/channelTracker.js')
const getSubList = require('./util/getSubList.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const MsgHandler = require('../util/MsgHandler.js')

module.exports = function (bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
  const botRole = message.guild.members.get(bot.user.id).highestRole
  const memberRoles = message.member.roles

  // Get an array of eligible roles that is lower than the bot's role, and is not @everyone by filtering it
  const filteredMemberRoles = memberRoles.filterArray(function (role) {
    return (role.comparePositionTo(botRole) < 0 && role.name !== '@everyone')
  })

  const eligibleRoles = []
  for (var a in filteredMemberRoles) eligibleRoles.push(filteredMemberRoles[a].name)

  if (filteredMemberRoles.length === 0) return message.channel.send('There are no eligible roles to be removed from you.').catch(err => console.log(`Promise Warning: subRem 1: ${err}`))

  const msgHandler = new MsgHandler(bot, message) // For deletion at the end of a series of menus

  const list = new Discord.RichEmbed()
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
      list.addField(options[option].source.title, `**Link**: ${options[option].source.link}\n**Channel:**: #${channelName}\n${roleList}`, true)
    }
  }

  // Some roles may not have a feed assigned since it prints all roles below the bot's role.
  if (filteredMemberRoles.length > 0) {
    let leftoverRoles = ''
    for (var leftoverRole in filteredMemberRoles) {
      leftoverRoles += filteredMemberRoles[leftoverRole].name + '\n'
    }
    list.addField(`No Feed Assigned`, leftoverRoles, true)
  }

  message.channel.send({embed: list})
  .then(function (list) {
    msgHandler.add(list)
    const collectorFilter = m => m.author.id === message.author.id
    const collector = message.channel.createMessageCollector(collectorFilter, {time: 240000})
    channelTracker.add(message.channel.id)
    collector.on('collect', function (response) {
      msgHandler.add(response)
      // Select a role here
      const chosenRoleName = response.content
      if (chosenRoleName.toLowerCase() === 'exit') return collector.stop('Self-subscription removal canceled.')
      const chosenRole = message.guild.roles.find('name', chosenRoleName)

      function isValidRole () {
        if (eligibleRoles.includes(chosenRoleName)) return true
      }

      if (!chosenRole || !isValidRole()) return message.channel.send('That is not a valid role to remove. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: subRem 2: ${err}`))

      collector.stop()
      message.member.removeRole(chosenRole)
      .then(function (member) {
        console.log(`Self subscription: (${message.guild.id}, ${message.guild.name}) => Removed *${chosenRole.name}* from member.`)
        message.channel.send(`You no longer have the role \`${chosenRole.name}\`.`).catch(err => console.log(`Promise Warning: subRem 3: ${err}`))
      })
      .catch(function (err) {
        console.log(`Self Subscription: (${message.guild.id}, ${message.guild.name}) => Could not remove role *${chosenRole.name}*, ` + err)
        message.channel.send(`An error occured - could not remove your role *${chosenRole.name}*`).catch(err => console.log(`Promise Warning: subRem 4: ${err}`))
      })
    })
    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      msgHandler.deleteAll(message.channel)
      if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
      else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
    })
  }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send self subscription removal prompt. (${err})`))
}

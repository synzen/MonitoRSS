const Discord = require('discord.js')
const channelTracker = require('../util/channelTracker.js')
const getSubList = require('./util/getSubList.js')

module.exports = function(bot, message, command) {
  var rssList = {}
  try {rssList = require(`../sources/${message.guild.id}.json`).sources} catch (e) {}

  let botRole = message.guild.members.get(bot.user.id).highestRole
  let memberRoles = message.member.roles
  let filteredMemberRoles = memberRoles.filterArray(function(role) {
    return (role.comparePositionTo(botRole) < 0 && role.name !== '@everyone')
  })
  let eligibleRoles = []
  for (var a in filteredMemberRoles) eligibleRoles.push(filteredMemberRoles[a].name);

  if (filteredMemberRoles.length === 0) return message.channel.sendMessage('There are no eligible roles to be removed from you.').catch(err => console.log(`Promise Warning: subRem 1: ${err}`));

  var list = new Discord.RichEmbed()
  .setTitle('Self-Subscription Removal')
  .setDescription('Below is the list of feeds, their channels, and its eligible roles that you may remove yourself from. Type the role name you want removed, or type *exit* to cancel.\n_____')

  let options = getSubList(bot, message.guild, rssList)
  for (var option in options) {
    var roleList = '';
    for (var memberRole in filteredMemberRoles) {
      if (options[option].roleList.includes(filteredMemberRoles[memberRole].id)) {
        roleList += filteredMemberRoles[memberRole].name + '\n';
        filteredMemberRoles.splice(memberRole, 1);
      }
    }
    if (roleList !== '') {
      let channelID = options[option].source.channel;
      let channelName = message.guild.channels.get(channelID).name;
      list.addField(options[option].source.title, `**Channel:**: #${channelName}\n${roleList}`, true);
    }
  }

  if (filteredMemberRoles.length > 0) {
    var leftoverRoles = '';
    for (var leftoverRole in filteredMemberRoles) {
      leftoverRoles += filteredMemberRoles[leftoverRole].name + '\n';
    }
    list.addField(`No Feed Assigned`, leftoverRoles, true);
  }
  message.channel.sendEmbed(list)
  .then(m => {
    const collectorFilter = m => m.author.id == message.author.id;
    const collector = message.channel.createCollector(collectorFilter,{time:240000})
    channelTracker.addCollector(message.channel.id)
    collector.on('message', function(response) {
      let chosenRoleName = response.content
      if (chosenRoleName.toLowerCase() === 'exit') return collector.stop('Self-subscription removal canceled.');
      let chosenRole = message.guild.roles.find('name', chosenRoleName)

      function isValidRole() {
        if (eligibleRoles.includes(chosenRoleName)) return true;
      }

      if (!chosenRole || !isValidRole()) message.channel.sendMessage('That is not a valid role to remove. Try again.').catch(err => console.log(`Promise Warning: subRem 2: ${err}`));
      else {
        collector.stop();
        message.member.removeRole(chosenRole)
        .then(m => {
          console.log(`Self subscription: (${message.guild.id}, ${message.guild.name}) => Removed *${chosenRole.name}* from member.`)
          message.channel.sendMessage(`You no longer have the role **${chosenRole.name}**.`).catch(err => console.log(`Promise Warning: subRem 3: ${err}`))
        })
        .catch(err => {
          console.log(`Self Subscription: (${message.guild.id}, ${message.guild.name}) => Could not remove role *${chosenRole.name}*, ` + err)
          message.channel.sendMessage(`An error occured - could not remove your role *${chosenRole.name}*`).catch(err => console.log(`Promise Warning: subRem 4: ${err}`))
        })
      }
    })
    collector.on('end', (collected, reason) => {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') return message.channel.sendMessage(reason);
    })
  })
  .catch(err => console.log(`Promise Warning: subRem Embed: ${err}`))
}

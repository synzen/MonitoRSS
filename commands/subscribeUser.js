const Discord = require('discord.js')
const channelTracker = require('../util/channelTracker.js')

function getSubList (bot, guild, rssList) {
  var finalList = []
  var botRole = guild.members.get(bot.user.id).highestRole;
  for (var rssIndex in rssList) {
    let globalSubList = rssList[rssIndex].roleSubscriptions;
    let filterList = rssList[rssIndex].filters;
    var roles = [];
    // globalSubList is an array
    if (typeof globalSubList === 'object' && globalSubList.length > 0) {
      for (var globalSubber in globalSubList) {
        let subbedRole = guild.roles.get(globalSubList[globalSubber].roleID);
        if (subbedRole.comparePositionTo(botRole) < 0) roles.push(subbedRole.id);
      }
    }
    // filteredSubList is an object with role IDs as key
    if (typeof filterList === 'object' && typeof filterList.roleSubscriptions === 'object') {
      for (var filteredSubber in filterList.roleSubscriptions) {
        let subbedRole = guild.roles.get(filteredSubber);
        if (subbedRole.comparePositionTo(botRole) < 0) roles.push(filteredSubber);
      }
    }
    if (roles.length !== 0) finalList.push({source: rssList[rssIndex], roleList: roles});
  }
  if (finalList.length === 0) return null;
  else return finalList;
}

exports.add = function (bot, message) {
  var rssList = []
  try {rssList = require(`../sources/${message.guild.id}.json`).sources} catch (e) {}
  if (rssList.length == 0) return message.channel.sendMessage('There are no active feeds to subscribe to.');

  var options = getSubList(bot, message.guild, rssList)
  if (!options) return message.channel.sendMessage('There are either no feeds with subscriptions, or no eligible subscribed roles that can be self-added.');

  var list = new Discord.RichEmbed()
  .setTitle('Self-Subscription Addition')
  .setDescription('Below is the list of feeds, their channels, and its eligible roles that you may add to yourself. Type the role name you want to be added to, or type *exit* to cancel.\n_____')

  for (var option in options) {
    var roleList = '';
    for (var roleID in options[option].roleList) {
      let roleName = message.guild.roles.get(options[option].roleList[roleID]).name;
      roleList += `${roleName}\n`;
    }
    let channelID = options[option].source.channel;
    let channelName = message.guild.channels.get(channelID).name;
    list.addField(options[option].source.title, `**Channel:** #${channelName}\n${roleList}`, true);
  }

  message.channel.sendEmbed(list)
  .then(m => {
    const collectorFilter = m => m.author.id == message.author.id;
    const collector = message.channel.createCollector(collectorFilter,{time:240000})
    channelTracker.addCollector(message.channel.id)
    collector.on('message', function (response) {
      let chosenRoleName = response.content
      if (chosenRoleName.toLowerCase() === 'exit') return collector.stop("Self-subscription addition canceled.");
      if (!bot.guilds.get(message.guild.id).roles.find('name', chosenRoleName)) message.channel.sendMessage('That is not a valid role subscription to add. Try again.');
      else {
        var found = false;
        let chosenRole = message.guild.roles.find('name', chosenRoleName);
        let chosenRoleID = chosenRole.id;
        for (var option in options) {
          if (options[option].roleList.includes(chosenRoleID)) {
            var source = options[option].source.title;
            found = true;
          }
        }
        if (found === false) message.channel.sendMessage('That is not a valid role subscription to add. Try again.');
        else {
          collector.stop();
          message.member.addRole(chosenRole)
          .then(m => {
            console.log(`Self Subscription: (${message.guild.id}, ${message.guild.name}) => Role *${chosenRole.name}* successfully added to member. `)
            message.channel.sendMessage(`You now have the role **${chosenRole.name}**, subscribed to the feed titled **${source}**.`)
          })
          .catch(err => {
            message.channel.sendMessage(`Error: Unable to add role.`)
            console.log(`(${message.guild.id}, ${message.guild.name}) => Could not add role *${chosenRole.name}* to member due to ` + err)
          });
        }
      }
    })
    collector.on('end', (collected, reason) => {
      channelTracker.removeCollector(message.channel.id)
      if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== "user") return message.channel.sendMessage(reason);
    })
  })
  .catch(err => console.log(`Self Subscription Error: (${message.guild.id}, ${message.guild.name}) => Could not send self-subscription prompt due to ` + err))
}

exports.remove = function (bot, message) {
  var rssList = []
  try {rssList = require(`../sources/${message.guild.id}.json`).sources} catch (e) {}

  let botRole = message.guild.members.get(bot.user.id).highestRole
  let memberRoles = message.member.roles
  let filteredMemberRoles = memberRoles.filterArray(function (role) {
    return (role.comparePositionTo(botRole) < 0 && role.name !== '@everyone')
  })
  let eligibleRoles = []
  for (var a in filteredMemberRoles) eligibleRoles.push(filteredMemberRoles[a].name);

  if (filteredMemberRoles.length === 0) return message.channel.sendMessage('There are no eligible roles to be removed from you.');

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
    collector.on('message', function (response) {
      let chosenRoleName = response.content
      if (chosenRoleName.toLowerCase() === 'exit') return collector.stop("Self-subscription removal canceled.");
      let chosenRole = message.guild.roles.find('name', chosenRoleName)

      function isValidRole () {
        if (eligibleRoles.includes(chosenRoleName)) return true;
      }

      if (!chosenRole || !isValidRole()) message.channel.sendMessage('That is not a valid role to remove. Try again.');
      else {
        collector.stop();
        message.member.removeRole(chosenRole)
        .then(m => {
          console.log(`Self subscription: (${message.guild.id}, ${message.guild.name}) => Removed *${chosenRole.name}* from member.`)
          message.channel.sendMessage(`You no longer have the role **${chosenRole.name}**.`)
        })
        .catch(err => {
          console.log(`Self Subscription: (${message.guild.id}, ${message.guild.name}) => Could not remove role *${chosenRole.name}*, ` + err)
          message.channel.sendMessage(`An error occured - could not remove your role *${chosenRole.name}*`)
        })
      }
    })
    collector.on('end', (collected, reason) => {
      channelTracker.removeCollector(message.channel.id)
      if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== "user") return message.channel.sendMessage(reason);
    })
  })
}

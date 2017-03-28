const Discord = require('discord.js')
const channelTracker = require('../util/channelTracker.js')
const getSubList = require('./util/getSubList.js')
const currentGuilds = require('../util/fetchInterval.js').currentGuilds

module.exports = function(bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.sendMessage('There are no active feeds to subscribe to.').catch(err => console.log(`Promise Warning: subAdd 1: ${err}`));

  const rssList = guildRss.sources
  const options = getSubList(bot, message.guild, rssList)
  if (!options) return message.channel.sendMessage('There are either no feeds with subscriptions, or no eligible subscribed roles that can be self-added.').catch(err => console.log(`Promise Warning: subAdd 2: ${err}`));

  const list = new Discord.RichEmbed()
  .setTitle('Self-Subscription Addition')
  .setDescription('Below is the list of feeds, their channels, and its eligible roles that you may add to yourself. Type the role name you want to be added to, or type *exit* to cancel.\u200b\n\u200b\n')

  // Generate list of all feeds and roles that can be added
  for (let option in options) {
    let roleList = '';
    for (var roleID in options[option].roleList) {
      let roleName = message.guild.roles.get(options[option].roleList[roleID]).name;
      roleList += `${roleName}\n`;
    }
    const channelID = options[option].source.channel;
    const channelName = message.guild.channels.get(channelID).name;
    list.addField(options[option].source.title, `**Channel:** #${channelName}\n${roleList}`, true);
  }

  // Send list
  message.channel.sendEmbed(list)
  .then(m => {
    const collectorFilter = m => m.author.id == message.author.id;
    const collector = message.channel.createCollector(collectorFilter,{time:240000})
    channelTracker.addCollector(message.channel.id)
    collector.on('message', function(response) {
      // Select a role here
      const chosenRoleName = response.content
      if (chosenRoleName.toLowerCase() === 'exit') return collector.stop('Self-subscription addition canceled.');
      if (!bot.guilds.get(message.guild.id).roles.find('name', chosenRoleName)) message.channel.sendMessage('That is not a valid role subscription to add. Try again.').catch(err => console.log(`Promise Warning: subAdd 3: ${err}`));
      else {
        const chosenRole = message.guild.roles.find('name', chosenRoleName);
        const chosenRoleID = chosenRole.id;
        let found = false;

        for (var option in options) {
          if (options[option].roleList.includes(chosenRoleID)) {
            var source = options[option].source.title;
            found = true;
          }
        }

        if (!found) return message.channel.sendMessage('That is not a valid role subscription to add. Try again.').catch(err => console.log(`Promise Warning: subAdd 4: ${err}`));

        collector.stop();
        if (message.member.roles.get(chosenRole.id)) return message.channel.sendMessage(`You already have that role.`).catch(err => console.log(`Promise Warning: subAdd 5: ${err}`));
        message.member.addRole(chosenRole)
        .then(m => {
          console.log(`Self Subscription: (${message.guild.id}, ${message.guild.name}) => Role *${chosenRole.name}* successfully added to member. `)
          message.channel.sendMessage(`You now have the role **${chosenRole.name}**, subscribed to the feed titled **${source}**.`).catch(err => console.log(`Promise Warning: subAdd 6: ${err}`))
        })
        .catch(err => {
          message.channel.sendMessage(`Error: Unable to add role.`).catch(err => console.log(`Promise Warning: subAdd 7: ${err}`))
          console.log(`(${message.guild.id}, ${message.guild.name}) => Could not add role *${chosenRole.name}* to member due to ` + err)
        });
      }
    })
    collector.on('end', (collected, reason) => {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') return message.channel.sendMessage(reason);
    })
  }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send self subscription addition prompt. (${err})`))
}

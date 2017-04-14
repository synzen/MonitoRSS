const Discord = require('discord.js')
const getRole = require('./util/getRole.js')
const getIndex = require('./util/printFeeds.js')
const fileOps = require('../util/fileOps.js')
const filters = require('./util/filters.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/fetchInterval.js').currentGuilds

module.exports = function(bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.sendMessage('Cannot add role customizations without any active feeds.').catch(err => console.log(`Promise Warning: rssRole 1: ${err}`));

  const rssList = guildRss.sources
  let role

  // Add global subscriptions
  function addGlobalSub (rssName, role) {
    const source = rssList[rssName]
    // remove any filtered subscriptions when adding global subscription, and delete parents if empty
    if (source.filters && source.filters.roleSubscriptions && source.filters.roleSubscriptions[role.id]) delete source.filters.roleSubscriptions[role.id];
    if (source.filters && source.filters.roleSubscriptions && source.filters.roleSubscriptions.size() === 0) delete source.filters.roleSubscriptions;
    if (source.filters && source.filters.size() === 0) delete source.filters;
    if (!source.roleSubscriptions) source.roleSubscriptions = [];
    for (var globalSubber in source.roleSubscriptions) {
      if (source.roleSubscriptions[globalSubber].roleID === role.id) return message.channel.sendMessage(`Unable to add global subscription. Role \`${role.name}\` is already subscribed to this feed.`);
    }
    source.roleSubscriptions.push({
      roleID: role.id,
      roleName: role.name
    })
    fileOps.updateFile(message.guild.id, guildRss)
    message.channel.sendMessage(`Global subscription successfully added for \`${message.guild.roles.get(role.id).name}\` to feed \`${rssList[rssName].title}\`.`).catch(err => console.log(`Promise Warning: rssRoles/addGlobalSub 1: ${err}`))
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${message.guild.roles.get(role.id).id}, ${message.guild.roles.get(role.id).name}) => Global subscription added to feed \`${rssList[rssName].title}\`.`)
  }

  // Remove global subscriptions
  function removeGlobalSub(rssName, role) {
    const source = rssList[rssName]
    let found = false
    if (source.roleSubscriptions.length === 0) delete source.roleSubscriptions;
    if (!source.roleSubscriptions) return message.channel.sendMessage('This role is not globally subscribed to this feed.').catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 1: ${err}`));

    for (var globalSubber in source.roleSubscriptions) {
      if (source.roleSubscriptions[globalSubber].roleID == role.id) {
        source.roleSubscriptions.splice(globalSubber, 1);
        found = true;
      }
    }
    if (source.roleSubscriptions.length === 0) delete source.roleSubscriptions;
    if (!found) return message.channel.sendMessage(`The role \`${role.name} does not have a global subscription to this feed.`).catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 2: ${err}`));

    message.channel.sendMessage(`Successfully removed the global subscription of the role \`${role.name}\` from the feed \`${rssList[rssName].title}\``).catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 3: ${err}`));
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${role.id}, ${role.name}) => Removed global subscription for feed \`${rssList[rssName].title}\``);
    return fileOps.updateFile(message.guild.id, guildRss);
  }

  // Adding or removing filtered/global subscriptions
  function openSubMenu(rssName, role, isGlobalSub) {
    const subMenu = new Discord.RichEmbed()
      .setColor(config.botSettings.menuColor)
      .setDescription(`**Selected Role**: ${role.name}\n**Feed Title:** ${rssList[rssName].title}\n**Feed Link:** ${rssList[rssName].link}\n\nSelect an option by typing its number, or type *exit* to cancel.\u200b\n\u200b\n`)

    if (!isGlobalSub) {
      subMenu.addField(`1) Add filter to filtered subscription`, `Add a filtered subscription so that this role will get mentioned everytime an article from a feed passes its filter tests.`);
      subMenu.addField(`2) Remove filtered subscription`, `Remove a word/phrase from this role's subscription to a feed.`);
      subMenu.setAuthor(`Role Customization - Add/Remove Filtered Subscription`);
    }
    else {
      subMenu.addField(`1) Add global subscription`, `Have the role get mentioned every time a new article is posted from this feed.`);
      subMenu.addField(`2) Remove global subscription`, `Remove the role's subscription to this feed.`);
      subMenu.setAuthor(`Role Cusotmization: Add/Remove Global Subscription`);
    }

    message.channel.sendEmbed(subMenu).catch(err => console.log(`Promise Warning: rssRoles/openSubMenu 1: ${err}`))

    const filter = m => m.author.id == message.author.id
    const filterOptionCollector = message.channel.createCollector(filter,{time:240000});
    channelTracker.addCollector(message.channel.id)

    filterOptionCollector.on('message', function (m) {
      const optionSelected = m.content
      if (optionSelected.toLowerCase() === 'exit') return filterOptionCollector.stop('RSS Role Customization menu closed.');
      // Adding
      if (optionSelected == 1) {
        filterOptionCollector.stop();
        if (!isGlobalSub) filters.add(message, rssName, role);
        else addGlobalSub(rssName, role);
      }
      // Removing
      else if (optionSelected == 2) {
        filterOptionCollector.stop();
        if (!isGlobalSub) {
          if (!rssList[rssName].filters || !rssList[rssName].filters.roleSubscriptions) return message.channel.sendMessage('This feed has no filtered subscriptions to remove.');
          filters.remove(message, rssName, role);
        }
        else {
          if (!rssList[rssName].roleSubscriptions) return message.channel.sendMessage('This feed has no global subscriptions to remove.').catch(err => console.log(`Promise Warning: rssRoles/openSubMenu 2: ${err}`));
          removeGlobalSub(rssName, role);
        }
      }
      else message.channel.sendMessage('That is not a valid option. Try again.').catch(err => console.log(`Promise Warning: rssRoles/openSubMenu 3: ${err}`))
    })

    filterOptionCollector.on('end', function(collected, reason) {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') return message.channel.sendMessage(reason);
    });
  }

  // Printing current subscriptions
  function printSubscriptions() {
    const guild = message.guild
    const subList = {}
    const msg = new Discord.RichEmbed()
      .setColor(config.botSettings.menuColor)
      .setDescription(`\nBelow are the feed titles with any roles subscribed to that feed under it. Each role is then categorized as either a global or filtered subscription.\u200b\n\u200b\n`)
      .setAuthor('Subscribed Roles List')

    for (var rssName in rssList) {
      const source = rssList[rssName];
      // global sub list is an array of objects
      if (source.roleSubscriptions) {
        for (let globalSubber in source.roleSubscriptions) {
          if (!subList[source.title]) subList[source.title] = {};
          if (!subList[source.title].globalSubs) subList[source.title].globalSubs = [];

          let globalSubbedRole = guild.roles.get(source.roleSubscriptions[globalSubber].roleID).name;
          subList[source.title].globalSubs.push(globalSubbedRole);
        }
      }
      // filtered sub list is an object
      if (source.filters && source.filters.roleSubscriptions ) {
        for (let filteredSubber in source.filters.roleSubscriptions) {
          if (!subList[source.title]) subList[source.title] = {};
          if (!subList[source.title].filteredSubs) subList[source.title].filteredSubs = [];

          let filteredSubbedRole = guild.roles.get(filteredSubber).name;
          subList[source.title].filteredSubs.push(filteredSubbedRole);
        }
      }
    }

    if (subList.size() === 0) return message.channel.sendMessage('There are no roles with subscriptions.').catch(err => console.log(`Promise Warning: rssRoles/printSub 1: ${err}`));
    else {
      for (var feed in subList) {
        let list = '';

        var globalSubList = '**Global Subscriptions:**\n';
        for (let globalSubber in subList[feed].globalSubs) {
           globalSubList += `${subList[feed].globalSubs[globalSubber]}\n`;
        }
        if (globalSubList !== '**Global Subscriptions:**\n') list += globalSubList;

        var filteredSubList = '\n**Filtered Subscriptions:**\n';
        for (let filteredSubber in subList[feed].filteredSubs) {
          filteredSubList += `${subList[feed].filteredSubs[filteredSubber]}\n`;
        }
        if (filteredSubList !== '\n**Filtered Subscriptions:**\n') list += filteredSubList;
        msg.addField(feed, list, true);
      }
      return message.channel.sendEmbed(msg).catch(err => console.log(`Promise Warning: rssRoles/printSub 2: ${err}`));
    }
  }

  // Remove all subscriptions for a role
  function deleteSubscription(roleID) {
    let found = false
    for (var index in rssList) {
      const source = rssList[index];
      // global sub list is an array
      if (source.roleSubscriptions) {
        for (var globalSubber in source.roleSubscriptions) {
          if (source.roleSubscriptions[globalSubber].roleID == roleID) {
            source.roleSubscriptions.splice(globalSubber, 1);
            if (source.roleSubscriptions.length === 0) delete source.roleSubscriptions;
            found = true;
          }
        }
      }
      // filtered sub list is an object
      if (source.filters && source.filters.roleSubscriptions) {
        for (var filteredSubber in source.filters.roleSubscriptions) {
          if (filteredSubber == roleID) {
            delete source.filters.roleSubscriptions[filteredSubber];
            if (source.filters.roleSubscriptions.size() === 0) delete source.filters.roleSubscriptions;
            if (source.filters.size() === 0) delete source.filters;
            found = true;
          }
        }
      }
    }
    if (!found) return message.channel.sendMessage('This role has no subscriptions to remove.').catch(err => console.log(`Promise Warning: rssRoles/delSub 1: ${err}`));
    fileOps.updateFile(message.guild.id, guildRss)
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${message.guild.roles.get(roleID).id}, ${message.guild.roles.get(roleID).name}) => All subscriptions deleted.`);
    return message.channel.sendMessage(`All subscriptions successfully deleted for role \`${message.guild.roles.get(roleID).name}\`.`).catch(err => console.log(`Promise Warning: rssRoles/delSub 2: ${err}`))
  }

  const menu = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setDescription(`\n**Current Channel:** #${message.channel.name}\n\nSelect an option by typing its number, or type *exit* to cancel.\u200b\n\u200b\n`)
    .setAuthor('Role Subscription Options')
    .addField(`1) Add/Remove Global Subscriptions for a Role`, `Enable mentions for a role for all delivered articles of this feed.\n*Using global subscriptions will disable filtered subscriptions if enabled for that role.*`)
    .addField(`2) Add/Remove Filtered Subscriptions for a Role`, `Create role-specific filters where only selected articles will mention a role.\n*Using filtered subscriptions will disable global subscriptions if enabled for that role.*`)
    .addField(`3) Disable All Subscriptions for a Role`, `Disable all subscriptions for a role.`)
    .addField(`4) List Roles with Subscriptions`, `List all roles with all types of subscriptions.`)

  message.channel.sendEmbed(menu).catch(err => console.log(`Promise Warning: rssRoles 2: ${err}`))
  .then(function(menu) {
    const collectorFilter = m => m.author.id === message.author.id
    const collector = message.channel.createCollector(collectorFilter,{time:240000})
    channelTracker.addCollector(message.channel.id)

    collector.on('message', function(m) {
      const optionSelected = m.content
      if (optionSelected.toLowerCase() == 'exit') return collector.stop('RSS Role Customization menu closed.');
      else if (!['1', '2', '3', '4'].includes(optionSelected)) return message.channel.sendMessage('That is not a valid option. Try again.').catch(err => console.log(`Promise Warning: rssRoles 3: ${err}`));

      if (optionSelected == 4) {
        collector.stop()
        return printSubscriptions(collector);
      }
      // Options 1, 2, and 3 requires a role to be acquired first
      else if (optionSelected == 3 || optionSelected == 2 || optionSelected == 1) {
        collector.stop()
        getRole(message, function(role) {
          if (!role) return;
          if (optionSelected == 3) return deleteSubscription(role.id);
          // Options 1 and 2 further requires a specific rss for adding/removing subscriptions
          else getIndex(bot, message, command, function(rssName) {
            if (optionSelected == 2) return openSubMenu(rssName, role, false);
            else if (optionSelected == 1) return openSubMenu(rssName, role, true);
          })
        })
      }

    })

    collector.on('end', function(collected, reason) {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') return message.channel.sendMessage(reason);
    });
  }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send roles menu. (${err})`))

}

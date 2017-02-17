const getRole = require('./util/getRole.js')
const printFeeds = require('./util/printFeeds.js')
const fileOps = require('../util/updateJSON.js')
const addFilter = require('./util/filterAdd.js')
const removeFilter = require('./util/filterRemove.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')

module.exports = function(bot, message, command) {
  const collectorFilter = m => m.author.id == message.author.id;

  try {var guildRss = require(`../sources/${message.guild.id}.json`)}
  catch (e) {return message.channel.sendMessage("Cannot add role customizations without any active feeds.")}

  var rssList = guildRss.sources
  var role

  function isEmptyObject(obj) {
      for(var prop in obj) {
          if(obj.hasOwnProperty(prop))
              return false;
      }
      return JSON.stringify(obj) === JSON.stringify({});
  }

  function addGlobalSub (rssIndex, role) {
    let source = rssList[rssIndex]
    //remove any filtered subscriptions when adding global subscription
    if (source.filters != null && source.filters.roleSubscriptions != null && source.filters.roleSubscriptions[role.id] != null) delete source.filters.roleSubscriptions[role.id];
    if (source.filters != null && source.filters.roleSubscriptions != null && isEmptyObject(source.filters.roleSubscriptions)) delete source.filters.roleSubscriptions;
    if (source.filters != null && isEmptyObject(source.filters)) delete source.filters;
    if (source.roleSubscriptions == null) source.roleSubscriptions = [];
    source.roleSubscriptions.push({
      roleID: role.id,
      roleName: role.name
    })
    message.channel.sendMessage(`Global subscription successfully added for \`${message.guild.roles.get(role.id).name}\` to feed \`${rssList[rssIndex].title}\`.`);
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${message.guild.roles.get(role.id).id}, ${message.guild.roles.get(role.id).name}) => Global subscription added to feed \`${rssList[rssIndex].title}\`.`);
    return fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`);
  }

  function removeGlobalSub (rssIndex, role) {
    let source = rssList[rssIndex]
    var found = false
    if (source.roleSubscriptions.length == 0) delete source.roleSubscriptions;
    if (source.roleSubscriptions == null) return message.channel.sendMessage("This role is not globally subscribed to this feed.");

    for (let globalSubber in source.roleSubscriptions) {
      if (source.roleSubscriptions[globalSubber].roleID == role.id) {source.roleSubscriptions.splice(globalSubber, 1); found = true;}
    }
    if (source.roleSubscriptions.length == 0) delete source.roleSubscriptions;
    if (found == false) return message.channel.sendMessage(`The role \`${role.name} does not have a global subscription to this feed.`);
    else message.channel.sendMessage(`Successfully removed the global subscription of the role \`${role.name}\` from the feed \`${rssList[rssIndex].title}\``);
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${role.id}, ${role.name}) => Removed global subscription for feed \`${rssList[rssIndex].title}\``);
    return fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`);
  }

  function openSubMenu (rssIndex, role, isGlobalSub) {
    var subMenu = {embed: {
      color: config.botSettings.menuColor,
      author: {},
      description: `**Selected Role**: ${role.name}\n**Feed Title:** ${rssList[rssIndex].title}\n**Feed Link:** ${rssList[rssIndex].link}\n\nSelect an option by typing its number, or type *exit* to cancel.\n_____`,
      footer: {}
    }}
    if (!isGlobalSub) {
      subMenu.embed.fields = [{name: `1) Add filter to filtered subscription`, value: `Add a filtered subscription so that this role will get mentioned everytime an article from a feed passes its filter tests.`},
                              {name: `2) Remove filtered subscription`, value: `Remove a word/phrase from this role's subscription to a feed.`}];
      subMenu.embed.author.name = `Role Customization - Add/Remove Filtered Subscription`;
    }
    else {
      subMenu.embed.fields = [{name: `1) Add global subscription`, value: `Have the role get mentioned every time a new article is posted from this feed.`},
                              {name: `2) Remove global subscription`, value: `Remove the role's subscription to this feed.`}];
      subMenu.embed.author.name = `Role Cusotmization: Add/Remove Global Subscription`;
    }

    message.channel.sendMessage("",subMenu)

    const filterOptionCollector = message.channel.createCollector(collectorFilter,{time:240000});
    channelTracker.addCollector(message.channel.id)

    filterOptionCollector.on('message', function (m) {
      let optionSelected = m.content
      if (optionSelected.toLowerCase() == "exit") return filterOptionCollector.stop("RSS Role Customization menu closed.");
      if (optionSelected == 1) {
        filterOptionCollector.stop();
        if (!isGlobalSub) addFilter(message, rssIndex, role);
        else addGlobalSub(rssIndex, role);
      }
      else if (optionSelected == 2) {
        filterOptionCollector.stop();
        if (!isGlobalSub) {
          if (rssList[rssIndex].filters == null || rssList[rssIndex].filters.roleSubscriptions == null) return message.channel.sendMessage("This feed has no filtered subscriptions to remove.");
          removeFilter(message, rssIndex, role);
        }
        else {
          if (rssList[rssIndex].roleSubscriptions == null) return message.channel.sendMessage("This feed has no global subscriptions to remove.");
          removeGlobalSub(rssIndex, role);
        }
      }
      else message.channel.sendMessage("That is not a valid option. Try again.")
    })

    filterOptionCollector.on('end', (collected, reason) => {
      channelTracker.removeCollector(message.channel.id)
      if (reason === "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== "user") return message.channel.sendMessage(reason);
    });
  }


  function printSubscriptions () {
    let guild = message.guild
    var subList = {}
    var msg = {embed: {
      color: config.botSettings.menuColor,
      description: `\nBelow are the feed titles with any roles subscribed to that feed under it. Each role is then categorized as either a global or filtered subscription.\n_____`,
      author: {name: `Subscribed Roles List`},
      fields: [],
      footer: {}
    }}

    for (let rssIndex in rssList) {
      let source = rssList[rssIndex];
      //global sub list is an array of objects
      if (source.roleSubscriptions != null) {
        for (let globalSubber in source.roleSubscriptions) {
          if (subList[source.title] == null) subList[source.title] = {};
          if (subList[source.title].globalSubs == null) subList[source.title].globalSubs = [];

          let globalSubbedRole = guild.roles.get(source.roleSubscriptions[globalSubber].roleID).name;
          subList[source.title].globalSubs.push(globalSubbedRole);
        }
      }
      //filtered sub list is an object
      if (source.filters != null && source.filters.roleSubscriptions != null) {
        for (let filteredSubber in source.filters.roleSubscriptions) {
          if (subList[source.title] == null) subList[source.title] = {};
          if (subList[source.title].filteredSubs == null) subList[source.title].filteredSubs = [];

          let filteredSubbedRole = guild.roles.get(filteredSubber).name;
          subList[source.title].filteredSubs.push(filteredSubbedRole);
        }
      }
    }

    if (isEmptyObject(subList)) return message.channel.sendMessage("There are no roles with subscriptions.");
    else {
      for (let feed in subList) {
        var list = "";

        var globalSubList = "**Global Subscriptions:**\n";
        for (let globalSubber in subList[feed].globalSubs) {
           globalSubList += `${subList[feed].globalSubs[globalSubber]}\n`;
        }
        if (globalSubList !== "**Global Subscriptions:**\n") list += globalSubList;

        var filteredSubList = "\n**Filtered Subscriptions:**\n";
        for (let filteredSubber in subList[feed].filteredSubs) {
          filteredSubList += `${subList[feed].filteredSubs[filteredSubber]}\n`;
        }
        if (filteredSubList !== "\n**Filtered Subscriptions:**\n") list += filteredSubList;
        msg.embed.fields.push({name: `${feed} `, value: list, inline: true});
      }
      return message.channel.sendMessage("", msg);
    }
  }

  function deleteSubscription (roleID) {
    var found = false
    for (var index in rssList) {
      var source = rssList[index];
      //global sub list is an array
      if (source.roleSubscriptions != null) {
        for (let globalSubber in source.roleSubscriptions) {
          if (source.roleSubscriptions[globalSubber].roleID == roleID) {source.roleSubscriptions.splice(globalSubber, 1); found = true;}
        }
      }
      //filtered sub list is an object
      if (source.filters != null && source.filters.roleSubscriptions != null) {
        for (let filteredSubber in source.filters.roleSubscriptions) {
          if (filteredSubber == roleID) {delete source.filters.roleSubscriptions[filteredSubber]; found = true;}
        }
      }
    }
    if (found == false) return message.channel.sendMessage("This role has no subscriptions to remove.");
    if (source.roleSubscriptions != null && source.roleSubscriptions.length == 0) delete source.roleSubscriptions;
    if (source.filters != null && isEmptyObject(source.filters.roleSubscriptions)) delete source.filters.roleSubscriptions;
    if (source.filters != null && isEmptyObject(source.filters)) delete source.filters;
    fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`)
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${message.guild.roles.get(roleID).id}, ${message.guild.roles.get(roleID).name}) => All subscriptions deleted.`);
    return message.channel.sendMessage(`All subscriptions successfully deleted for role \`${message.guild.roles.get(roleID).name}\`.`)
  }

  var menu = {embed: {
    color: config.botSettings.menuColor,
    description: `\nCurrent Channel: #${message.channel.name}\n\nSelect an option by typing its number, or type *exit* to cancel.\n_____`,
    author: {name: `Role Subscription Options`},
    fields: [{name: `1) Add/Remove Global Subscriptions for a Role`, value: `Enable mentions for a role for all delivered articles of this feed.\n*Using global subscriptions will disable filtered subscriptions if enabled for that role.*`},
            {name: `2) Add/Remove Filtered Subscriptions for a Role`, value: `Create role-specific filters where only selected articles will mention a role.\n*Using filtered subscriptions will disable global subscriptions if enabled for that role.*`},
            {name: `3) Disable All Subscriptions for a Role`, value: `Disable all subscriptions for a role.`},
            {name: `4) List Roles with Subscriptions`, value: `List all roles with all types of subscriptions.`}],
    footer: {}
  }}

  message.channel.sendMessage("", menu)

  const collector = message.channel.createCollector(collectorFilter,{time:240000})
  channelTracker.addCollector(message.channel.id)

  collector.on('message', function (m) {
    let optionSelected = m.content
    if (optionSelected.toLowerCase() == "exit") return collector.stop("RSS Role Customization menu closed.");

    if (optionSelected == 4) {
      collector.stop()
      return printSubscriptions(collector);
    }
    else if (optionSelected == 3 || optionSelected == 2 || optionSelected == 1) {
      collector.stop()
      getRole(message, function(role) {
        if (!role) return;
        if (optionSelected == 3) return deleteSubscription(role.id);
        else printFeeds(bot, message, true, command, function(rssIndex) {
          if (optionSelected == 2) return openSubMenu(rssIndex, role, false);
          else if (optionSelected == 1) return openSubMenu(rssIndex, role, true);
        })
      })
    }
    else message.channel.sendMessage("That is not a valid option. Try again.");
  })

  collector.on('end', (collected, reason) => {
    channelTracker.removeCollector(message.channel.id)
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
    else if (reason !== "user") return message.channel.sendMessage(reason);
  });

}

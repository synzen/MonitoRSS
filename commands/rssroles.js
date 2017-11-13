const Discord = require('discord.js')
const getRole = require('./util/getRole.js')
const chooseFeed = require('./util/chooseFeed.js')
const fileOps = require('../util/fileOps.js')
const filters = require('./util/filters.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const MsgHandler = require('../util/MsgHandler.js')

module.exports = function (bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('Cannot add role customizations without any active feeds.').catch(err => console.log(`Promise Warning: rssRole 1: ${err}`))

  const rssList = guildRss.sources

  // Add global subscriptions, called from openSubMenu
  function addGlobalSub (rssName, role) {
    const source = rssList[rssName]
    // remove any filtered subscriptions when adding global subscription, and delete parents if empty
    if (source.filters && source.filters.roleSubscriptions && source.filters.roleSubscriptions[role.id]) delete source.filters.roleSubscriptions[role.id]
    if (source.filters && source.filters.roleSubscriptions && source.filters.roleSubscriptions.size() === 0) delete source.filters.roleSubscriptions
    if (source.filters && source.filters.size() === 0) delete source.filters
    if (!source.roleSubscriptions) source.roleSubscriptions = []
    for (var globalSubber in source.roleSubscriptions) {
      if (source.roleSubscriptions[globalSubber].roleID === role.id) return message.channel.send(`Unable to add global subscription. Role \`${role.name}\` is already subscribed to this feed.`)
    }
    source.roleSubscriptions.push({
      roleID: role.id,
      roleName: role.name
    })
    fileOps.updateFile(message.guild.id, guildRss)
    message.channel.send(`Global subscription successfully added for \`${message.guild.roles.get(role.id).name}\` to feed <${rssList[rssName].link}>.`).catch(err => console.log(`Promise Warning: rssRoles/addGlobalSub 1: ${err}`))
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${message.guild.roles.get(role.id).id}, ${message.guild.roles.get(role.id).name}) => Global subscription added to feed ${rssList[rssName].link}.`)
  }

  // Remove global subscriptions, called from openSubMenu
  function removeGlobalSub (rssName, role) {
    const source = rssList[rssName]
    let found = false
    if (source.roleSubscriptions.length === 0) delete source.roleSubscriptions
    if (!source.roleSubscriptions) return message.channel.send(`This role is not globally subscribed to the feed <${rssList[rssName].link}>.`).catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 1: ${err}`))

    for (var globalSubber in source.roleSubscriptions) {
      if (source.roleSubscriptions[globalSubber].roleID === role.id) {
        source.roleSubscriptions.splice(globalSubber, 1)
        found = true
      }
    }
    if (source.roleSubscriptions.length === 0) delete source.roleSubscriptions
    if (!found) return message.channel.send(`The role \`${role.name} does not have a global subscription to this feed.`).catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 2: ${err}`))

    message.channel.send(`Successfully removed the global subscription of the role \`${role.name}\` from the feed <${rssList[rssName].link}>`).catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 3: ${err}`))
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${role.id}, ${role.name}) => Removed global subscription for feed <${rssList[rssName].link}>.`)
    return fileOps.updateFile(message.guild.id, guildRss)
  }

  // Adding or removing filtered/global subscriptions
  function openSubMenu (rssName, role, isGlobalSub, msgHandler) {
    const subMenu = new Discord.RichEmbed()
      .setColor(config.botSettings.menuColor)
      .setDescription(`**Selected Role**: ${role.name}\n**Feed Title:** ${rssList[rssName].title}\n**Feed Link:** ${rssList[rssName].link}\n\nSelect an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n`)

    if (!isGlobalSub) {
      subMenu.addField(`1) Add filter to filtered subscription`, `Add a filtered subscription so that this role will get mentioned everytime an article from a feed passes its filter tests.`)
      subMenu.addField(`2) Remove filtered subscription`, `Remove a word/phrase from this role's subscription to a feed.`)
      subMenu.setAuthor(`Role Customization - Add/Remove Filtered Subscription`)
    } else {
      subMenu.addField(`1) Add global subscription`, `Have the role get mentioned every time a new article is posted from this feed.`)
      subMenu.addField(`2) Remove global subscription`, `Remove the role's subscription to this feed.`)
      subMenu.setAuthor(`Role Cusotmization - Add/Remove Global Subscription`)
    }

    message.channel.send({embed: subMenu}).catch(err => console.log(`Promise Warning: rssRoles/openSubMenu 1: ${err}`))
    .then(function (msgPrompt) {
      msgHandler.add(msgPrompt)

      const filter = m => m.author.id === message.author.id
      const filterOptionCollector = message.channel.createMessageCollector(filter, {time: 240000})
      channelTracker.add(message.channel.id)

      filterOptionCollector.on('collect', function (m) {
        msgHandler.add(m)
        const optionSelected = m.content
        if (optionSelected.toLowerCase() === 'exit') return filterOptionCollector.stop('RSS Role Customization menu closed.')
        // Adding
        if (optionSelected === '1') {
          filterOptionCollector.stop()
          if (!isGlobalSub) filters.add(message, rssName, role, msgHandler)
          else addGlobalSub(rssName, role)
        } else if (optionSelected === '2') { // Removing
          filterOptionCollector.stop()
          if (!isGlobalSub) {
            if (!rssList[rssName].filters || !rssList[rssName].filters.roleSubscriptions) return message.channel.send(`There are no filtered subscriptions to remove from the feed <${rssList[rssName].link}>.`)
            filters.remove(message, rssName, role, msgHandler)
          } else {
            if (!rssList[rssName].roleSubscriptions) return message.channel.send(`There are no global subscriptions to remove from the feed <${rssList[rssName].link}>.`).catch(err => console.log(`Promise Warning: rssRoles/openSubMenu 2: ${err}`))
            removeGlobalSub(rssName, role)
          }
        } else message.channel.send('That is not a valid option. Try again.').catch(err => console.log(`Promise Warning: rssRoles/openSubMenu 3: ${err}`))
      })

      filterOptionCollector.on('end', function (collected, reason) {
        channelTracker.remove(message.channel.id)
        msgHandler.deleteAll(message.channel)
        if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
        else if (reason !== 'user') return message.channel.send(reason).then(m => m.delete(6000))
      })
    })
  }

  // Printing current subscriptions
  function printSubscriptions () {
    const guild = message.guild
    const subList = {}
    const msg = new Discord.RichEmbed()
      .setColor(config.botSettings.menuColor)
      .setDescription(`\nBelow are the feed titles with any roles subscribed to that feed under it. Each role is then categorized as either a global or filtered subscription.\u200b\n\u200b\n`)
      .setAuthor('Subscribed Roles List')

    for (var rssName in rssList) {
      const source = rssList[rssName]
      // global sub list is an array of objects
      if (source.roleSubscriptions) {
        for (let globalSubber in source.roleSubscriptions) {
          if (!subList[source.title]) subList[source.title] = {}
          if (!subList[source.title].globalSubs) subList[source.title].globalSubs = []

          let globalSubbedRole = guild.roles.get(source.roleSubscriptions[globalSubber].roleID).name
          subList[source.title].globalSubs.push(globalSubbedRole)
        }
      }
      // filtered sub list is an object
      if (source.filters && source.filters.roleSubscriptions) {
        for (let filteredSubber in source.filters.roleSubscriptions) {
          if (!subList[source.title]) subList[source.title] = {}
          if (!subList[source.title].filteredSubs) subList[source.title].filteredSubs = []

          let filteredSubbedRole = guild.roles.get(filteredSubber).name
          subList[source.title].filteredSubs.push(filteredSubbedRole)
        }
      }
    }

    if (subList.size() === 0) return message.channel.send(`There are no roles with subscriptions for the feed <${rssList[rssName].link}>.`).catch(err => console.log(`Promise Warning: rssRoles/printSub 1: ${err}`))
    else {
      for (var feed in subList) {
        let list = ''

        var globalSubList = '**Global Subscriptions:**\n'
        for (let globalSubber in subList[feed].globalSubs) {
          globalSubList += `${subList[feed].globalSubs[globalSubber]}\n`
        }
        if (globalSubList !== '**Global Subscriptions:**\n') list += globalSubList

        var filteredSubList = '\n**Filtered Subscriptions:**\n'
        for (let filteredSubber in subList[feed].filteredSubs) {
          filteredSubList += `${subList[feed].filteredSubs[filteredSubber]}\n`
        }
        if (filteredSubList !== '\n**Filtered Subscriptions:**\n') list += filteredSubList
        msg.addField(feed, list, true)
      }
      return message.channel.send({embed: msg}).catch(err => console.log(`Promise Warning: rssRoles/printSub 2: ${err}`))
    }
  }

  // Remove all subscriptions for a role
  function deleteSubscription (roleID, msgHandler) {
    let found = false
    for (var index in rssList) {
      const source = rssList[index]
      // global sub list is an array
      if (source.roleSubscriptions) {
        for (var globalSubber in source.roleSubscriptions) {
          if (source.roleSubscriptions[globalSubber].roleID === roleID) {
            source.roleSubscriptions.splice(globalSubber, 1)
            if (source.roleSubscriptions.length === 0) delete source.roleSubscriptions
            found = true
          }
        }
      }
      // filtered sub list is an object
      if (source.filters && source.filters.roleSubscriptions) {
        for (var filteredSubber in source.filters.roleSubscriptions) {
          if (filteredSubber === roleID) {
            delete source.filters.roleSubscriptions[filteredSubber]
            if (source.filters.roleSubscriptions.size() === 0) delete source.filters.roleSubscriptions
            if (source.filters.size() === 0) delete source.filters
            found = true
          }
        }
      }
    }
    msgHandler.deleteAll(message.channel)
    if (!found) return message.channel.send('This role has no subscriptions to remove.').catch(err => console.log(`Promise Warning: rssRoles/delSub 1: ${err}`))
    fileOps.updateFile(message.guild.id, guildRss)
    console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${message.guild.roles.get(roleID).id}, ${message.guild.roles.get(roleID).name}) => All subscriptions deleted.`)
    return message.channel.send(`All subscriptions successfully deleted for role \`${message.guild.roles.get(roleID).name}\`.`).catch(err => console.log(`Promise Warning: rssRoles/delSub 2: ${err}`))
  }

  const firstMsgHandler = new MsgHandler(bot, message)

  const menu = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setDescription(`\n**Current Channel:** #${message.channel.name}\n\nSelect an option by typing its number, or type *exit* to cancel.\u200b\n\u200b\n`)
    .setAuthor('Role Subscription Options')
    .addField(`1) Add/Remove Global Subscriptions for a Role`, `Enable mentions for a role for all delivered articles of this feed.\n*Using global subscriptions will disable filtered subscriptions if enabled for that role.*`)
    .addField(`2) Add/Remove Filtered Subscriptions for a Role`, `Create role-specific filters where only selected articles will mention a role.\n*Using filtered subscriptions will disable global subscriptions if enabled for that role.*`)
    .addField(`3) Disable All Subscriptions for a Role`, `Disable all subscriptions for a role.`)
    .addField(`4) List Roles with Subscriptions`, `List all roles with all types of subscriptions.`)

  message.channel.send({embed: menu})
  .then(function (menu) {
    const collectorFilter = m => m.author.id === message.author.id
    const collector = message.channel.createMessageCollector(collectorFilter, {time: 240000})
    channelTracker.add(message.channel.id)

    firstMsgHandler.add(menu)

    collector.on('collect', function (m) {
      firstMsgHandler.add(m)
      const optionSelected = m.content
      if (optionSelected.toLowerCase() === 'exit') return collector.stop('RSS Role Customization menu closed.')
      else if (!['1', '2', '3', '4'].includes(optionSelected)) return message.channel.send('That is not a valid option. Try again.').catch(err => console.log(`Promise Warning: rssRoles 3: ${err}`))

      if (optionSelected === '4') {
        collector.stop()
        firstMsgHandler.deleteAll(message.channel)
        return printSubscriptions()
      } else if (optionSelected === '3' || optionSelected === '2' || optionSelected === '1') { // Options 1, 2, and 3 requires a role to be acquired first
        collector.stop()
        getRole(message, firstMsgHandler, function (role) {
          if (!role) return
          if (optionSelected === '3') return deleteSubscription(role.id, firstMsgHandler)
          // Options 1 and 2 requires a specific rss for adding/removing subscriptions
          else {
            chooseFeed(bot, message, command, function (rssName, msgHandler) {
              if (optionSelected === '2') return openSubMenu(rssName, role, false, msgHandler)
              else if (optionSelected === '1') return openSubMenu(rssName, role, true, msgHandler)
            }, null, firstMsgHandler)
          }
        })
      }
    })

    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'user') return // Do not execute msgHandler.deleteAll if is user, since this means menu series proceeded to the next step and has not ended
      if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
      else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
      firstMsgHandler.deleteAll(message.channel)
    })
  }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send roles menu. (${err})`))
}

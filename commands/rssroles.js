const Discord = require('discord.js')
const fileOps = require('../util/fileOps.js')
const filters = require('./util/filters.js')
const config = require('../config.json')
const currentGuilds = require('../util/storage.js').currentGuilds
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')
const VALID_OPTIONS = ['1', '2', '3', '4']

function printSubscriptions (message, rssList) {
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

  if (Object.keys(subList).length === 0) return message.channel.send(`There are no roles with subscriptions for the feed <${rssList[rssName].link}>.`).catch(err => console.log(`Promise Warning: rssRoles/printSub 1: ${err}`))
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
function deleteSubscription (message, guildRss, roleID) {
  const rssList = guildRss.sources
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
          if (Object.keys(source.filters.roleSubscriptions).length === 0) delete source.filters.roleSubscriptions
          if (Object.keys(source.filters).length === 0) delete source.filters
          found = true
        }
      }
    }
  }
  if (!found) return message.channel.send('This role has no subscriptions to remove.').catch(err => console.log(`Promise Warning: rssRoles/delSub 1: ${err}`))
  fileOps.updateFile(guildRss)
  console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${message.guild.roles.get(roleID).id}, ${message.guild.roles.get(roleID).name}) => All subscriptions deleted.`)
  return message.channel.send(`All subscriptions successfully deleted for role \`${message.guild.roles.get(roleID).name}\`.`).catch(err => console.log(`Promise Warning: rssRoles/delSub 2: ${err}`))
}

  // Add global subscriptions, called from openSubMenu
function addGlobalSub (message, guildRss, rssName, role) {
  const source = guildRss.sources[rssName]
    // remove any filtered subscriptions when adding global subscription, and delete parents if empty
  if (source.filters && source.filters.roleSubscriptions && source.filters.roleSubscriptions[role.id]) delete source.filters.roleSubscriptions[role.id]
  if (source.filters && source.filters.roleSubscriptions && Object.keys(source.filters.roleSubscriptions).length === 0) delete source.filters.roleSubscriptions
  if (source.filters && Object.keys(source.filters).length === 0) delete source.filters
  if (!source.roleSubscriptions) source.roleSubscriptions = []
  for (var globalSubber in source.roleSubscriptions) {
    if (source.roleSubscriptions[globalSubber].roleID === role.id) return message.channel.send(`Unable to add global subscription. Role \`${role.name}\` is already subscribed to this feed.`)
  }
  source.roleSubscriptions.push({
    roleID: role.id,
    roleName: role.name
  })
  fileOps.updateFile(guildRss)
  message.channel.send(`Global subscription successfully added for \`${message.guild.roles.get(role.id).name}\` to feed <${source.link}>.`).catch(err => console.log(`Promise Warning: rssRoles/addGlobalSub 1: ${err}`))
  console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${message.guild.roles.get(role.id).id}, ${message.guild.roles.get(role.id).name}) => Global subscription added to feed ${source.link}.`)
}

  // Remove global subscriptions, called from openSubMenu
function removeGlobalSub (message, guildRss, rssName, role) {
  const source = guildRss.sources[rssName]
  let found = false
  if (source.roleSubscriptions.length === 0) delete source.roleSubscriptions
  if (!source.roleSubscriptions) return message.channel.send(`This role is not globally subscribed to the feed <${source.link}>.`).catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 1: ${err}`))

  for (var globalSubber in source.roleSubscriptions) {
    if (source.roleSubscriptions[globalSubber].roleID === role.id) {
      source.roleSubscriptions.splice(globalSubber, 1)
      found = true
    }
  }
  if (source.roleSubscriptions.length === 0) delete source.roleSubscriptions
  if (!found) return message.channel.send(`The role \`${role.name} does not have a global subscription to this feed.`).catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 2: ${err}`))

  message.channel.send(`Successfully removed the global subscription of the role \`${role.name}\` from the feed <${source.link}>`).catch(err => console.log(`Promise Warning: rssRoles/remGlobalSub 3: ${err}`))
  console.log(`Guild Roles: (${message.guild.id}, ${message.guild.name}) => (${role.id}, ${role.name}) => Removed global subscription for feed <${source.link}>.`)
  return fileOps.updateFile(guildRss)
}

function filteredSubFn (m, data, callback) {
  const { guildRss, rssName, role } = data
  const source = guildRss.sources[rssName]
  const input = m.content // 1 = add, 2 = remove
  if (input === '1') {
    callback(null, { ...data,
      next: {
        merge: filters.add(m, guildRss, rssName, role)
      }})
  } else if (input === '2') {
    if (!source.filters || !source.filters.roleSubscriptions) return callback(new Error(`There are no filtered subscriptions to remove from the feed <${source.link}>.`))
    callback(null, { ...data,
      next: {
        merge: filters.remove(m, guildRss, rssName, role)
      }})
  } else callback(new SyntaxError('That is not a valid option. Try again, or type `exit` to cancel.'))
}

function globalSubFn (m, data, callback) {
  const { guildRss, rssName, role } = data
  const source = guildRss.sources[rssName]
  const input = m.content // 1 = add, 2 = remove
  if (input === '1') {
    addGlobalSub(m, guildRss, rssName, role)
    callback(null, data)
  } else if (input === '2') {
    if (!source.roleSubscriptions) return callback(new Error(`There are no global subscriptions to remove from the feed <${source.link}>.`))
    removeGlobalSub(m, guildRss, rssName, role)
    callback(null, data)
  } else callback(new SyntaxError('That is not a valid option. Try again, or type `exit` to cancel.'))
}

function checkRole (m, data, callback) {
  const input = m.content
  const mention = m.mentions.roles.first()
  if (mention) return callback(null, { ...data, role: mention })
  const role = m.guild.roles.find('name', input)
  if (!role || input === '@everyone') return callback(new SyntaxError('That is not a valid role. Try again, or type `exit` to cancel.'))
  else if (m.guild.roles.findAll('name', input).length > 1) return callback(new SyntaxError('There are multiple roles with that name. Mention the role, type another role, or type `exit` to cancel.'))
  callback(null, { ...data, role: role })
}

function feedSelectorFn (m, data, callback) {
  const { guildRss, rssName, role } = data
  const source = guildRss.sources[rssName]
  callback(null, { ...data,
    next:
    { embed: {
      description: `**Selected Role**: ${role.name}\n**Feed Title:** ${source.title}\n**Feed Link:** ${source.link}\n\nSelect an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n` } }
  })
}

function selectOption (m, data, callback) {
  const optionSelected = m.content
  if (!VALID_OPTIONS.includes(optionSelected)) return callback(new SyntaxError('That is not a valid option. Try again, or type `exit` to cancel.'))
  const callbackObj = { ...data, optionSelected: optionSelected }

  if (optionSelected === '4') return callback(null, callbackObj)
  else if (optionSelected === '3' || optionSelected === '2' || optionSelected === '1') { // Options 1, 2, and 3 requires a role to be acquired first
    const getRole = new MenuUtils.Menu(m, checkRole, { text: 'Enter a valid case-sensitive role name, or mention a role. The `@everyone` role cannot be used.' })
    if (optionSelected === '3') {
      callbackObj.next = { add: getRole }
      return callback(null, callbackObj)
    }

    const feedSelector = new FeedSelector(m, feedSelectorFn, { command: data.command })

    if (optionSelected === '2') { // Filtered Sub Menu
      const filteredSubMenu = new MenuUtils.Menu(m, filteredSubFn)
        .setAuthor(`Role Customization - Add/Remove Filtered Subscription`)
        .addOption(`Add filter to filtered subscription`, `Add a filtered subscription so that this role will get mentioned everytime an article from a feed passes its filter tests.`)
        .addOption(`Remove filter from filtered subscription`, `Remove a word/phrase from this role's subscription to a feed.`)
      callbackObj.next = { add: [getRole, feedSelector, filteredSubMenu] }
    } else { // Global Sub Menu
      const globalSubMenu = new MenuUtils.Menu(m, globalSubFn)
        .setAuthor(`Role Customization - Add/Remove Global Subscription`)
        .addOption(`Add global subscription`, `Have the role get mentioned every time a new article is posted from this feed.`)
        .addOption(`Remove global subscription`, `Remove the role's subscription to this feed.`)
      callbackObj.next = { add: [getRole, feedSelector, globalSubMenu] }
    }

    return callback(null, callbackObj)
  }
}

module.exports = (bot, message, command) => {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) return message.channel.send('Cannot add role customizations without any active feeds.').catch(err => console.log(`Promise Warning: rssRole 1: ${err}`))

  const rssList = guildRss.sources

  const ask = new MenuUtils.Menu(message, selectOption)
    .setDescription(`\n**Current Channel:** #${message.channel.name}\n\nSelect an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n`)
    .setAuthor('Role Subscription Options')
    .addOption(`Add/Remove Global Subscriptions for a Role`, `Enable mentions for a role for all delivered articles of this feed.\n*Using global subscriptions will disable filtered subscriptions if enabled for that role.*`)
    .addOption(`Add/Remove Filtered Subscriptions for a Role`, `Create role-specific filters where only selected articles will mention a role.\n*Using filtered subscriptions will disable global subscriptions if enabled for that role.*`)
    .addOption(`Disable All Subscriptions for a Role`, `Disable all subscriptions for a role.`)
    .addOption(`List Roles with Subscriptions`, `List all roles with all types of subscriptions.`)

  new MenuUtils.MenuSeries(message, [ask], { command: command }).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { optionSelected, role } = data
      if (optionSelected === '4') return printSubscriptions(message, rssList)
      if (optionSelected === '3') return deleteSubscription(message, guildRss, role.id)
      // 2 and 1 are handled within the Menu functions due to their complexity
    } catch (err) {
      console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rssroles:`, err.message || err)
    }
  })
}

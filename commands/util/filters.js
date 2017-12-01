const Discord = require('discord.js')
const fileOps = require('../../util/fileOps.js')
const config = require('../../config.json')
const channelTracker = require('../../util/channelTracker.js')
const currentGuilds = require('../../util/storage.js').currentGuilds
const filterTypes = ['Title', 'Description', 'Summary', 'Author', 'Tag']

exports.add = function (message, rssName, role, msgHandler) {
  const guildRss = currentGuilds.get(message.guild.id)
  const rssList = guildRss.sources

  if (!rssList[rssName].filters) rssList[rssName].filters = {}
  if (role && !rssList[rssName].filters.roleSubscriptions) rssList[rssName].filters.roleSubscriptions = {}
  if (role && !rssList[rssName].filters.roleSubscriptions[role.id]) {
    rssList[rssName].filters.roleSubscriptions[role.id] = {
      roleName: role.name,
      filters: {}
    }
  }

  const filterList = (role) ? rssList[rssName].filters.roleSubscriptions[role.id].filters : rssList[rssName].filters // Select the correct filter list, whether if it's for a role's filtered subscription or feed filters. null role = not adding filter for role

  const msg = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setAuthor('List of Filter Categories')
    .setDescription(`**Chosen Feed:** ${rssList[rssName].link}${(role) ? '\n**Chosen Role:** ' + role.name : ''}\n\nBelow is the list of filter categories you may add filters to. Type the filter category for which you would like you add a filter to, or type **exit** to cancel.\u200b\n\u200b\n`)

  // Generate the filter categories here
  for (var filterType in filterTypes) {
    msg.addField(filterTypes[filterType], '\u200b', false)
  }

  message.channel.send({embed: msg})
  .then(function (m) {
    msgHandler.add(m)
    const filter = m => m.author.id === message.author.id
    const filterTypeCollect = message.channel.createMessageCollector(filter, {time: 240000})
    channelTracker.add(message.channel.id)

    filterTypeCollect.on('collect', function (filterType) {
      msgHandler.add(filterType)
      // Select the filter category here

      if (filterType.content === 'exit') return filterTypeCollect.stop('Filter addition menu closed.')
      let chosenFilterType = ''

      // Validate the chosen filter category
      for (var a in filterTypes) {
        if (filterType.content.toLowerCase() === filterTypes[a].toLowerCase()) chosenFilterType = filterTypes[a]
      }

      if (!chosenFilterType) return message.channel.send('That is not a valid filter category. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: filterAdd 2: ${err}`))

      // Valid filter category was chosen
      filterTypeCollect.stop()
      message.channel.send(`Type the filter word/phrase you would like to add in the category \`${chosenFilterType}\` by typing it, type multiple word/phrases on different lines to add more than one, or type \`{exit}\` to cancel. The following can be added in front of a search term to change its behavior:\n\n
\`~\` - Broad filter modifier to trigger even if the term is found embedded inside words/phrases.
\`!\` - NOT filter modifier to do the opposite of a normal search term. Can be added in front of any term, including one with broad filter mod.
\`\\\` - Escape symbol added before modifiers to interpret them as regular characters and not modifiers.\n\n
Filters will be applied as **case insensitive** to feeds.`)
      .then(function (m) {
        msgHandler.add(m)
        const filterCollect = message.channel.createMessageCollector(filter, {time: 240000})
        channelTracker.add(message.channel.id)

        filterCollect.on('collect', function (chosenFilter) {
          msgHandler.add(chosenFilter)
          if (chosenFilter.content === '{exit}') return filterCollect.stop('Filter addition menu closed.')
          // Global subs are always deleted if filtered subs are added
          if (!role) delete rssList[rssName].roleSubscriptions
          if (!filterList[chosenFilterType]) filterList[chosenFilterType] = []
          message.channel.send(`Updating filters...`)
          .then(function (editing) {
            filterCollect.stop()

            // Assume the chosen filters are an array
            let addList = chosenFilter.content.trim().split('\n') // Valid items to be added
            let addedList = '' // Valid items that were added
            let invalidItems = '' // Invalid items that were not added
            for (var item in addList) {
              if (!filterList[chosenFilterType].includes(addList[item].trim()) && addList[item].trim()) { // Account for invalid items, AKA duplicate filters.
                filterList[chosenFilterType].push(addList[item].trim())
                addedList += `\n${addList[item].trim()}`
              } else invalidItems += `\n${addList[item]}`
            }

            fileOps.updateFile(message.guild.id, guildRss)

            if (!role) {
              console.log(`RSS Filters: (${message.guild.id}, ${message.guild.name}) => New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${rssList[rssName].link}.`)
              let msg = `The following filter(s) have been successfully added for the filter category \`${chosenFilterType}\`:\`\`\`\n\n${addedList}\`\`\`You may test random articles with \`${config.botSettings.prefix}rsstest\`, or specifically send filtered articles with \`${config.botSettings.prefix}rssfilters\` option 5.`
              if (invalidItems) {
                msg += `\n\nThe following filter(s) could not be added because they already exist:\n\`\`\`\n\n${invalidItems}\`\`\``
                editing.edit(msg).catch(err => console.log(`Promise Warning: filterAdd 4a1: ${err}`))
              } else editing.edit(`${msg}\n\nYou may test your filters via \`${config.botSettings.prefix}rsstest\` and see what feeds pass through.`).catch(err => console.log(`Promise Warning: filterAdd 4a: ${err}`))
            } else {
              console.log(`RSS Roles: (${message.guild.id}, ${message.guild.name}) => Role (${role.id}, ${role.name}) => New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${rssList[rssName].link}.`)
              let msg = `Subscription updated for role \`${role.name}\`. The following filter(s) have been successfully added for the filter category \`${chosenFilterType}\`:\`\`\`\n\n${addedList}\`\`\``
              if (invalidItems) msg += `\n\nThe following filter(s) could not be added because they already exist:\n\`\`\`\n\n${invalidItems}\`\`\``
              editing.edit(`${msg}\n\nYou may test your filters on random articles via \`${config.botSettings.prefix}rsstest\` and see what articles will mention the role`).catch(err => console.log(`Promise Warning: filterAdd 4b: ${err}`))
            }
          })
          .catch(err => console.log(`Promise Warning: filterAdd 4: ${err}`))
        })
        filterCollect.on('end', function (collected, reason) {
          channelTracker.remove(message.channel.id)
          msgHandler.deleteAll(message.channel)
          if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
          else if (reason !== 'user') return message.channel.send(reason).then(m => m.delete(6000))
        })
      })
      .catch(err => console.log(`Promise Warning: filterAdd 3: ${err}`))
    })

    filterTypeCollect.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'user') return // Do not execute msgHandler.deleteAll if is user, since this means menu series proceeded to the next step and has not ended
      if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
      else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
      msgHandler.deleteAll(message.channel)
    })
  })
  .catch(err => console.log(`Promise Warning: filterAdd 1: ${err}`))
}

exports.remove = function (message, rssName, role, msgHandler) {
  const guildRss = currentGuilds.get(message.guild.id)
  const rssList = guildRss.sources
  const filterList = (role) ? rssList[rssName].filters.roleSubscriptions[role.id].filters : rssList[rssName].filters // Select the correct filter list, whether if it's for a role's filtered subscription or feed filters. null role = not adding filter for role

  if (!filterList || typeof filterList !== 'object') {
    msgHandler.deleteAll(message.channel)
    return message.channel.send(`There are no filters to remove for ${rssList[rssName].link}.`).catch(err => `Promise Warning: filterRemove 1: ${err}`)
  }

  let isEmptyFilter = true

  // Find any existing filter category objects
  if (rssList[rssName].filters && typeof rssList[rssName].filters === 'object') {
    for (var prop in rssList[rssName].filters) if (prop !== 'roleSubscriptions') isEmptyFilter = false
  }

  if (!role && isEmptyFilter) {
    msgHandler.deleteAll(message.channel)
    return message.channel.send(`There are no filters to remove for ${rssList[rssName].link}.`).catch(err => `Promise Warning: filterRemove 2: ${err}`)
  }

  const msg = new Discord.RichEmbed()
  .setColor(config.botSettings.menuColor)
  .setDescription(`**Feed Title:** ${rssList[rssName].title}\n**Feed Link:** ${rssList[rssName].link}\n\nBelow are the filter categories with their words/phrases under each. Type the filter category for which you would like you remove a filter from, or type **exit** to cancel.\u200b\n\u200b\n`)
  .setAuthor(`List of Assigned Filters`)

  for (var filterCategory in filterList) {
    if (filterCategory !== 'roleSubscriptions') {
      let value = ''
      for (var filter in filterList[filterCategory]) value += `${filterList[filterCategory][filter]}\n`
      msg.addField(filterCategory, value, true)
    }
  }

  message.channel.send({embed: msg})
  .then(function (m) {
    msgHandler.add(m)
    const filter = m => m.author.id === message.author.id
    const filterTypeCollect = message.channel.createMessageCollector(filter, {time: 240000})
    channelTracker.add(message.channel.id)

    filterTypeCollect.on('collect', function (filterType) {
      msgHandler.add(filterType)
      // Select filter category here
      if (filterType.content === 'exit') return filterTypeCollect.stop('Filter removal menu closed.')
      var chosenFilterType = ''

      // Cross reference with valid filter types and see if valid
      for (var a in filterTypes) {
        if (filterType.content.toLowerCase() === filterTypes[a].toLowerCase()) chosenFilterType = filterTypes[a]
      }

      if (!chosenFilterType) return message.channel.send('That is not a valid filter category. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: filterRemove 5: ${err}`))

      // Valid filter category has been selected.
      filterTypeCollect.stop()
      message.channel.send(`Confirm the filter word/phrase you would like to remove in the category \`${chosenFilterType}\` by typing one or multiple word/phrases separated by new lines (case sensitive).`).catch(err => console.log(`Promise Warning: filterRemove 6: ${err}`))

      const filterCollect = message.channel.createMessageCollector(filter, {time: 240000})
      channelTracker.add(message.channel.id)

      filterCollect.on('collect', function (chosenFilter) {
        msgHandler.add(chosenFilter)
        // Select the word/phrase filter here from that filter category
        const removeList = chosenFilter.content.trim().split('\n') // Items to be removed
        let validFilter = false
        let invalidItems = '' // Invalid items that could not be removed

        for (var item in removeList) {
          let valid = false
          for (var filterIndex in filterList[chosenFilterType]) {
            if (filterList[chosenFilterType][filterIndex] === removeList[item]) {
              valid = true
              if (typeof validFilter !== 'object') validFilter = [] // Initialize as empty array if valid item found
              validFilter.push({filter: removeList[item], index: filterIndex}) // Store the valid filter's information for removal
            }
          }
          if (!valid && removeList[item]) invalidItems += `\n${removeList[item]}` // Invalid items are ones that do not exist
        }

        if (chosenFilter.content === 'exit') return filterCollect.stop('Filter removal menu closed.')
        else if (!validFilter) return message.channel.send(`That is not a valid filter to remove from \`${chosenFilterType}\`. Try again.`).then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: filterRemove 7: ${err}`))

        message.channel.send(`Removing filter ${chosenFilter.content} from category ${chosenFilterType}...`)
        .then(function (editing) {
          filterCollect.stop()
          let deletedList = '' // Valid items that were removed
          for (var i = validFilter.length - 1; i >= 0; i--) { // Delete the filters stored from before from highest index to lowest since it is an array
            deletedList += `\n${validFilter[i].filter}`
            filterList[chosenFilterType].splice(validFilter[i].index, 1)
            if (filterList[chosenFilterType].length === 0) delete filterList[chosenFilterType]
          }

          // Check after removal if there are any empty objects
          if (role && filterList.size() === 0) delete rssList[rssName].filters.roleSubscriptions[role.id]
          if (role && rssList[rssName].filters.roleSubscriptions.size() === 0) delete rssList[rssName].filters.roleSubscriptions
          if (rssList[rssName].filters.size() === 0) delete rssList[rssName].filters

          fileOps.updateFile(message.guild.id, guildRss)

          if (!role) {
            console.log(`RSS Filters: (${message.guild.id}, ${message.guild.name}) => Filter(s) [${deletedList.trim().split('\n')}] removed from '${chosenFilterType}' for ${rssList[rssName].link}.`)
            let msg = `The following filter(s) have been successfully removed from the filter category \`${chosenFilterType}\`:\`\`\`\n\n${deletedList}\`\`\``
            if (invalidItems) msg += `\n\nThe following filter(s) were unable to be deleted because they do not exist:\n\`\`\`\n\n${invalidItems}\`\`\``
            editing.edit(msg).catch(err => console.log(`Promise Warning: filterRemove 8a: ${err}`))
          } else {
            console.log(`RSS Roles: (${message.guild.id}, ${message.guild.name}) => Role (${role.id}, ${role.name}) => Filter(s) [${deletedList.trim().split('\n')}] removed from '${chosenFilterType}' for ${rssList[rssName].link}.`)
            let msg = `Subscription updated for role \`${role.name}\`. The following filter(s) have been successfully removed from the filter category \`${chosenFilterType}\`:\`\`\`\n\n${deletedList}\`\`\``
            if (invalidItems) msg += `\n\nThe following filters were unable to be removed because they do not exist:\n\`\`\`\n\n${invalidItems}\`\`\``
            editing.edit(msg).catch(err => console.log(`Promise Warning: filterRemove 8b: ${err}`))
          }
        }).catch(err => console.log(`Promise Warning: filterRemove 8: ${err}`))
      })
      filterCollect.on('end', function (collected, reason) {
        channelTracker.remove(message.channel.id)
        msgHandler.deleteAll(message.channel)
        if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
        else if (reason !== 'user') return message.channel.send(reason).then(m => m.delete(6000))
      })
    })
    filterTypeCollect.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'user') return
      if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
      else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
      msgHandler.deleteAll(message.channel)
    })
  })
  .catch(err => console.log(`Promise Warning: filterRemove 3: ${err}`))
}

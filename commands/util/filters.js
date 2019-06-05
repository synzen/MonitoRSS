const dbOps = require('../../util/dbOps.js')
const config = require('../../config.js')
const filterTypes = [
  { show: 'Title', use: 'title' },
  { show: 'Description', use: 'description' },
  { show: 'Summary', use: 'summary' },
  { show: 'Author', use: 'author' },
  { show: 'Tags', use: 'tags' }
]
const MenuUtils = require('../../structs/MenuUtils.js')
const log = require('../../util/logger.js')

// BEGIN ADD FUNCTIONS

async function selectCategoryFn (m, data) {
  let chosenFilterType = ''
  const input = m.content
  // Validate the chosen filter category
  if (input.startsWith('raw:')) chosenFilterType = input
  else {
    for (var x = 0; x < filterTypes.length; ++x) {
      if (input.toLowerCase() === filterTypes[x].use) chosenFilterType = filterTypes[x].use
    }
  }

  if (!chosenFilterType) throw new SyntaxError('That is not a valid filter category. Try again, or type `exit` to cancel.')

  return { ...data,
    chosenFilterType: chosenFilterType,
    next: {
      text: `Type the filter word/phrase you would like to add in the category \`${chosenFilterType}\` by typing it, type multiple word/phrases on different lines to add more than one, or type \`exit\` to cancel. The following can be added in front of a search term to change its behavior:\n\n
\`~\` - Broad filter modifier to trigger even if the term is found embedded inside words/phrases.
\`!\` - NOT filter modifier to do the opposite of a normal search term. Can be added in front of any term, including one with broad filter mod.
\`\\\` - Escape symbol added before modifiers to interpret them as regular characters and not modifiers.\n\n
Filters will be applied as **case insensitive** to feeds. Because of this, all input will be converted to be lowercase.`
    } }
}

async function inputFilterFn (m, data) {
  const { guildRss, rssName, role, user, filterList, chosenFilterType } = data
  const source = guildRss.sources[rssName]
  const input = m.content

  if (!filterList[chosenFilterType]) filterList[chosenFilterType] = []
  const editing = await m.channel.send(`Updating filters...`)

  // Assume the chosen filters are an array
  const addList = input.trim().split('\n').map(item => item.trim().toLowerCase()).filter((item, index, self) => item && index === self.indexOf(item)) // Valid items to be added, trimmed and lowercased
  let addedList = '' // Valid items that were added
  let invalidItems = '' // Invalid items that were not added
  addList.forEach(item => {
    if (!filterList[chosenFilterType].includes(item.trim())) { // Account for invalid items, AKA duplicate filters.
      filterList[chosenFilterType].push(item.trim())
      addedList += `\n${item.trim()}`
    } else invalidItems += `\n${item}`
  })

  if (!user && !role) {
    log.command.info(`New filter(s) [${addedList.trim().split('\n')}] being added to '${chosenFilterType}' for ${source.link}`, m.guild)
    await dbOps.guildRss.update(guildRss, true)
    let msg = ''
    if (addedList) msg = `The following filter(s) have been successfully added for the filter category \`${chosenFilterType}\`:\n\`\`\`\n\n${addedList}\`\`\``
    if (invalidItems) msg += `\nThe following filter(s) could not be added because they already exist:\n\`\`\`\n\n${invalidItems}\`\`\``
    if (addedList) msg += `\nYou may test random articles with \`${config.bot.prefix}rsstest\` to see what articles pass your filters, or specifically send filtered articles with \`${config.bot.prefix}rssfilters\` option 5.`
    await editing.edit(`${msg}\n\nAfter completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`)
  } else {
    log.command.info(`New ${user ? 'user' : 'role'} filter(s) [${addedList.trim().split('\n')}] being added to '${chosenFilterType}' for ${source.link}.`, m.guild, user || role)
    await dbOps.guildRss.update(guildRss, true)
    let msg = `Subscription updated for ${user ? 'user' : 'role'} \`${user ? `${user.username}#${user.discriminator}` : role.name}\`. The following filter(s) have been successfully added for the filter category \`${chosenFilterType}\`:\n\`\`\`\n\n${addedList}\`\`\``
    if (invalidItems) msg += `\nThe following filter(s) could not be added because they already exist:\n\`\`\`\n\n${invalidItems}\`\`\``
    if (addedList) msg += `\nYou may test your filters on random articles via \`${config.bot.prefix}rsstest\` and see what articles will mention the ${user ? 'user' : 'role'}.`
    await editing.edit(`${msg}\n\nAfter completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`)
  }

  return { __end: true }
}

exports.add = (message, guildRss, rssName, role, user) => {
  const selectCategory = new MenuUtils.Menu(message, selectCategoryFn, { numbered: false })
  const inputFilter = new MenuUtils.Menu(message, inputFilterFn)
  const source = guildRss.sources[rssName]

  const targetId = role ? role.id : user ? user.id : undefined
  const targetName = role ? role.name : user ? user.username : undefined
  const targetType = role ? 'Role' : user ? 'User' : undefined
  let targetFilterList
  if (targetId) {
    if (!source.subscribers) source.subscribers = []
    for (const subscriber of source.subscribers) {
      if (subscriber.id === targetId) {
        if (!subscriber.filters) subscriber.filters = {}
        targetFilterList = subscriber.filters
      }
    }
    if (!targetFilterList) {
      source.subscribers.push({
        type: targetType.toLowerCase(),
        id: targetId,
        name: targetName,
        filters: {}
      })
      targetFilterList = source.subscribers[source.subscribers.length - 1].filters
    }
  } else {
    if (!source.filters) source.filters = {}
    targetFilterList = source.filters
  }

  // Select the correct filter list, whether if it's for a role's filtered subscription or feed filters. null role = not adding filter for role
  const options = []
  for (var x = 0; x < filterTypes.length; ++x) {
    options.push({ title: filterTypes[x].show, description: '\u200b' })
  }

  const data = { guildRss: guildRss,
    rssName: rssName,
    role: role,
    user: user,
    filterList: targetFilterList,
    next:
    { embed: {
      title: 'Feed Filters Customization',
      description: `**Chosen Feed:** ${source.link}${targetId ? `\n**Chosen ${targetType}:** ${targetName}` : ''}\n\nBelow is the list of filter categories you may add filters to. Type the filter category for which you would like you add a filter to, or type **exit** to cancel. To type a filter category that's not listed here but is in the raw rssdump, start it with \`raw:\`.\u200b\n\u200b\n`,
      options: options
    }
    }
  }

  return new MenuUtils.MenuSeries(message, [selectCategory, inputFilter], data)
}

// END ADD FUNCTIONS

// BEGIN REMOVE FUNCTIONS

async function filterRemoveCategory (m, data, callback) {
  // Select filter category here
  const input = m.content
  var chosenFilterType = ''

  if (input.startsWith('raw:')) chosenFilterType = input
  else {
    for (var x = 0; x < filterTypes.length; ++x) {
      if (input.toLowerCase() === filterTypes[x].use) chosenFilterType = filterTypes[x].use
    }
  }

  if (!chosenFilterType) throw new SyntaxError('That is not a valid filter category. Try again, or type `exit` to cancel.')
  return { ...data,
    chosenFilterType: chosenFilterType,
    next: {
      text: `Confirm the filter word/phrase you would like to remove in the category \`${chosenFilterType}\` by typing one or multiple word/phrases separated by new lines (case sensitive).`,
      embed: null
    } }
}

async function removeFilterFn (m, data) {
  const { guildRss, rssName, role, user, chosenFilterType, filterList } = data
  const source = guildRss.sources[rssName]
  // Select the word/phrase filter here from that filter category
  const removeList = m.content.trim().split('\n').map(item => item.trim()).filter((item, index, self) => item && index === self.indexOf(item)) // Items to be removed
  let validFilter = false
  let invalidItems = '' // Invalid items that could not be removed

  removeList.forEach(item => {
    let valid = false
    const categoryList = filterList[chosenFilterType]
    categoryList.forEach((filter, i) => {
      if (filter !== item) return
      valid = true
      if (typeof validFilter !== 'object') validFilter = [] // Initialize as empty array if valid item found
      validFilter.push({ filter: item, index: i }) // Store the valid filter's information for removal
    })
    if (!valid) invalidItems += `\n${item}` // Invalid items are ones that do not exist
  })

  if (!validFilter) throw new SyntaxError(`That is not a valid filter to remove from \`${chosenFilterType}\`. Try again, or type \`exit\` to cancel.`)

  const editing = await m.channel.send(`Removing filter \`${m.content}\` from category \`${chosenFilterType}\`...`)
  let deletedList = '' // Valid items that were removed
  for (var i = validFilter.length - 1; i >= 0; i--) { // Delete the filters stored from before from highest index to lowest since it is an array
    deletedList += `\n${validFilter[i].filter}`
    filterList[chosenFilterType].splice(validFilter[i].index, 1)
    if (filterList[chosenFilterType].length === 0) delete filterList[chosenFilterType]
  }

  // Check after removal if there are any empty objects
  const targetId = role ? role.id : user ? user.id : null
  if (targetId) {
    const { subscribers } = source
    if (subscribers && subscribers.length > 0) {
      for (let i = 0; i < subscribers.length; ++i) {
        const subscriber = subscribers[i]
        if (subscriber.id !== targetId) continue
        if (!subscriber.filters || Object.keys(subscriber.filters).length === 0) subscribers.splice(i, 1)
      }
    }
    if (subscribers.length === 0) delete source.subscribers
  }

  if (!user && !role) {
    let msg = `The following filter(s) have been successfully removed from the filter category \`${chosenFilterType}\`:\`\`\`\n\n${deletedList}\`\`\``
    if (invalidItems) msg += `\n\nThe following filter(s) were unable to be deleted because they do not exist:\n\`\`\`\n\n${invalidItems}\`\`\``
    log.command.info(`Removing filter(s) [${deletedList.trim().split('\n')}] from '${chosenFilterType}' for ${source.link}`, m.guild)
    await dbOps.guildRss.update(guildRss)
    await editing.edit(`${msg}\n\nAfter completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`).catch(err => log.command.warning(`filterRemove 8a`, m.guild, err))
  } else {
    let msg = `Subscription updated for ${user ? 'user' : 'role'} \`${user ? `${user.username}#${user.discriminator}` : role.name}\`. The following filter(s) have been successfully removed from the filter category \`${chosenFilterType}\`:\`\`\`\n\n${deletedList}\`\`\``
    if (invalidItems) msg += `\n\nThe following filters were unable to be removed because they do not exist:\n\`\`\`\n\n${invalidItems}\`\`\``
    log.command.info(`Removing ${user ? 'user' : 'role'} filter(s) [${deletedList.trim().split('\n')}] from '${chosenFilterType}' for ${source.link}`, m.guild, user || role)
    await dbOps.guildRss.update(guildRss)
    await editing.edit(`${msg}\n\nAfter completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`).catch(err => log.command.warning(`filterRemove 8b`, m.guild, err))
  }
  return { __end: true }
}

exports.remove = (message, guildRss, rssName, role, user) => {
  const source = guildRss.sources[rssName]
  let targetFilterList
  const targetId = role ? role.id : user ? user.id : undefined

  if (targetId) {
    const { subscribers } = source
    if (subscribers) {
      for (const subscriber of subscribers) {
        if (subscriber.id === targetId) targetFilterList = subscriber.filters
      }
    }
  } else targetFilterList = source.filters

  const selectCategory = new MenuUtils.Menu(message, filterRemoveCategory, { numbered: false })
  const removeFilter = new MenuUtils.Menu(message, removeFilterFn)

  if (!targetFilterList) return message.channel.send(`There are no filters to remove for ${source.link}${user ? ` for the user \`${user.username}#${user.discriminator}\`` : role ? ` for the role \`${role.name}\`` : ''}.`).catch(err => log.command.warning(`filterRemove 1`, message.guild, err))

  const options = []
  for (const filterCategory in targetFilterList) {
    let value = ''
    for (const filter in targetFilterList[filterCategory]) value += `${targetFilterList[filterCategory][filter]}\n`
    options.push({ title: filterCategory, description: value, inline: true })
  }

  const data = { guildRss: guildRss,
    rssName: rssName,
    role: role,
    user: user,
    filterList: targetFilterList,
    next:
    { embed: {
      author: { text: `List of Assigned Filters` },
      description: `**Feed Title:** ${source.title}\n**Feed Link:** ${source.link}\n\nBelow are the filter categories with their words/phrases under each. Type the filter category for which you would like you remove a filter from, or type **exit** to cancel.\u200b\n\u200b\n`,
      options: options
    }
    }
  }

  return new MenuUtils.MenuSeries(message, [selectCategory, removeFilter], data)
}

// END REMOVE FUNCTIONS

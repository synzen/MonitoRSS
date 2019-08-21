const dbOpsGuilds = require('../../util/db/guilds.js')
const config = require('../../config.js')
const filterTypes = [
  { show: 'Title', use: 'title' },
  { show: 'Description', use: 'description' },
  { show: 'Summary', use: 'summary' },
  { show: 'Author', use: 'author' },
  { show: 'Tags', use: 'tags' }
]
const MenuUtils = require('../../structs/MenuUtils.js')
const Translator = require('../../structs/Translator.js')
const log = require('../../util/logger.js')

// BEGIN ADD FUNCTIONS

async function selectCategoryFn (m, data) {
  let chosenFilterType = ''
  const { guildRss, filterList } = data
  const input = m.content
  const translator = new Translator(guildRss ? guildRss.locale : null)
  const translate = translator.translate.bind(translator)

  // Validate the chosen filter category
  if (input.startsWith('raw:') || input.startsWith('other:')) {
    chosenFilterType = input
  } else {
    for (let x = 0; x < filterTypes.length; ++x) {
      if (input.toLowerCase() === filterTypes[x].use) {
        chosenFilterType = filterTypes[x].use
      }
    }
  }

  if (!chosenFilterType) {
    throw new MenuUtils.MenuOptionError(translate('commands.utils.filters.invalidCategory'))
  } else if (typeof filterList[chosenFilterType] === 'string') {
    await m.channel.send(translate('commands.utils.filters.regexExists', { category: chosenFilterType }))
    return { __end: true }
  }

  return { ...data,
    chosenFilterType: chosenFilterType,
    next: {
      text: translate('commands.utils.filters.promptAdd', { type: chosenFilterType })
    } }
}

async function inputFilterFn (m, data) {
  const { guildRss, rssName, role, user, filterList, chosenFilterType } = data
  const source = guildRss.sources[rssName]
  const input = m.content
  const prefix = guildRss.prefix || config.bot.prefix
  const translator = new Translator(guildRss.locale)
  const translate = translator.translate.bind(translator)
  if (!filterList[chosenFilterType]) {
    filterList[chosenFilterType] = []
  }

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

  await dbOpsGuilds.update(guildRss)
  if (!user && !role) {
    log.command.info(`New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${source.link}`, m.guild)
    let msg = ''
    if (addedList) msg = `${translate('commands.utils.filters.addSuccess')} \`${chosenFilterType}\`:\n\`\`\`\n\n${addedList}\`\`\``
    if (invalidItems) msg += `\n${translate('commands.utils.filters.addFailed')}:\n\`\`\`\n\n${invalidItems}\`\`\``
    if (addedList) msg += translate('commands.utils.filters.testFilters', { prefix })
    await m.channel.send(`${msg}\n\n${translate('generics.backupReminder', { prefix })}`)
  } else {
    log.command.info(`New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${source.link}.`, m.guild, user || role)
    let msg = `${translate('commands.utils.filters.updatedFor', { name: user ? `${user.username}#${user.discriminator}` : role.name })} ${translate('commands.utils.filters.addSuccess')} \`${chosenFilterType}\`:\n\`\`\`\n\n${addedList}\`\`\``
    if (invalidItems) msg += `\n${translate('commands.utils.filters.addFailed')}:\n\`\`\`\n\n${invalidItems}\`\`\``
    if (addedList) msg += translate('commands.utils.filters.testFiltersSubscriber', { prefix })
    await m.channel.send(`${msg}\n\n${translate('generics.backupReminder', { prefix })}`)
  }

  return { __end: true }
}

exports.add = (message, guildRss, rssName, role, user) => {
  const selectCategory = new MenuUtils.Menu(message, selectCategoryFn, { numbered: false })
  const inputFilter = new MenuUtils.Menu(message, inputFilterFn)
  const source = guildRss.sources[rssName]
  const translator = new Translator(guildRss.locale)
  const translate = translator.translate.bind(translator)

  const targetId = role ? role.id : user ? user.id : undefined
  const targetName = role ? role.name : user ? user.username : undefined
  const targetType = role ? translate('commands.utils.filters.role') : user ? translate('commands.utils.filters.user') : undefined
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
  const options = filterTypes.map(item => ({ title: item.show, description: '\u200b' }))

  const data = { guildRss: guildRss,
    rssName: rssName,
    role: role,
    user: user,
    filterList: targetFilterList,
    next:
    { embed: {
      title: translate('commands.utils.filters.filtersCustomization'),
      description: `**${translate('commands.utils.filters.feed')}:** ${source.link}${targetId ? `\n**${targetType}:** ${targetName}` : ''}\n\n${translate('commands.utils.filters.categoryDescription')}`,
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
  const { filterList, guildRss } = data
  const translator = new Translator(guildRss ? guildRss.locale : null)
  const translate = translator.translate.bind(translator)
  let chosenFilterType = ''

  if (input.startsWith('raw:') || input.startsWith('other:')) {
    chosenFilterType = input
  } else {
    for (let x = 0; x < filterTypes.length; ++x) {
      if (input.toLowerCase() === filterTypes[x].use) {
        chosenFilterType = filterTypes[x].use
      }
    }
  }

  if (!chosenFilterType) {
    throw new MenuUtils.MenuOptionError(translate('commands.utils.filters.invalidCategory'))
  } else if (typeof filterList[chosenFilterType] === 'string') {
    await m.channel.send(translate('commands.utils.filters.regexExists', { category: chosenFilterType }))
    return { __end: true }
  }

  return { ...data,
    chosenFilterType: chosenFilterType,
    next: {
      text: translate('commands.utils.filters.removeFilterConfirm', { category: chosenFilterType }),
      embed: null
    } }
}

async function removeFilterFn (m, data) {
  const { guildRss, rssName, role, user, chosenFilterType, filterList } = data
  const source = guildRss.sources[rssName]
  const translator = new Translator(guildRss.locale)
  const translate = translator.translate.bind(translator)
  const prefix = guildRss.prefix || config.bot.prefix
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

  if (!validFilter) {
    throw new MenuUtils.MenuOptionError(translate('commands.utils.filters.removeFilterInvalid', { category: chosenFilterType }))
  }

  let deletedList = '' // Valid items that were removed
  for (let i = validFilter.length - 1; i >= 0; i--) { // Delete the filters stored from before from highest index to lowest since it is an array
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

  await dbOpsGuilds.update(guildRss)
  if (!user && !role) {
    let msg = `${translate('commands.utils.filters.removeSuccess')} \`${chosenFilterType}\`:\`\`\`\n\n${deletedList}\`\`\``
    if (invalidItems) msg += `\n\n${translate('commands.utils.filters.removeFailedNoExist')}:\n\`\`\`\n\n${invalidItems}\`\`\``
    log.command.info(`Removed filter(s) [${deletedList.trim().split('\n')}] from '${chosenFilterType}' for ${source.link}`, m.guild)
    await m.channel.send(`${msg}\n\n${translate('generics.backupReminder', { prefix })}`).catch(err => log.command.warning(`filterRemove 8a`, m.guild, err))
  } else {
    let msg = `${translate('commands.utils.filters.removeSuccessSubscriber', { name: user ? `${user.username}#${user.discriminator}` : role.name })} \`${chosenFilterType}\`:\`\`\`\n\n${deletedList}\`\`\``
    if (invalidItems) msg += `\n\n${translate('commands.utils.filters.removeFailedNoExist')}:\n\`\`\`\n\n${invalidItems}\`\`\``
    log.command.info(`Removed ${user ? 'user' : 'role'} filter(s) [${deletedList.trim().split('\n')}] from '${chosenFilterType}' for ${source.link}`, m.guild, user || role)
    await m.channel.send(`${msg}\n\n${translate('generics.backupReminder', { prefix })}`).catch(err => log.command.warning(`filterRemove 8b`, m.guild, err))
  }
  return { __end: true }
}

exports.remove = (message, guildRss, rssName, role, user) => {
  const source = guildRss.sources[rssName]
  const translator = new Translator(guildRss.locale)
  const translate = translator.translate.bind(translator)
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

  if (!targetFilterList) {
    return message.channel.send(translate('commands.utils.filters.removeNone', { link: source.link })).catch(err => log.command.warning(`filterRemove 1`, message.guild, err))
  }

  const options = []
  for (const filterCategory in targetFilterList) {
    const filterContent = targetFilterList[filterCategory]
    let value = ''
    if (typeof filterContent === 'string') {
      value = `\`\`\`${filterContent}\`\`\``
    } else {
      for (const filter in targetFilterList[filterCategory]) {
        value += `${targetFilterList[filterCategory][filter]}\n`
      }
    }
    options.push({ title: filterCategory, description: value, inline: true })
  }

  const data = { guildRss: guildRss,
    rssName: rssName,
    role: role,
    user: user,
    filterList: targetFilterList,
    next:
    { embed: {
      author: { text: translate('commands.utils.filters.listOfFilters') },
      description: translate('commands.utils.filters.listOfFiltersDescription', { title: source.title, link: source.link }),
      options: options
    }
    }
  }

  return new MenuUtils.MenuSeries(message, [selectCategory, removeFilter], data)
}

// END REMOVE FUNCTIONS

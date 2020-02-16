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
const Subscriber = require('../../structs/db/Subscriber.js')
const log = require('../../util/logger.js')

// BEGIN ADD FUNCTIONS

async function selectCategoryFn (m, data) {
  let chosenFilterType = ''
  const { profile } = data
  const input = m.content
  const locale = profile ? profile.locale : undefined
  const translator = new Translator(locale)
  const translate = translator.translate.bind(translator)

  // Validate the chosen filter category
  if (input.startsWith('raw:') || input.startsWith('other:')) {
    chosenFilterType = input
  } else {
    chosenFilterType = filterTypes.find(type => type.use === input.toLowerCase())
    if (chosenFilterType) {
      chosenFilterType = chosenFilterType.use
    }
  }

  if (!chosenFilterType) {
    throw new MenuUtils.MenuOptionError(translate('commands.utils.filters.invalidCategory'))
  }
  // else if (typeof filterList[chosenFilterType] === 'string') {
  // await m.channel.send(translate('commands.utils.filters.regexExists', { category: chosenFilterType }))
  // return { __end: true }
  // }

  return {
    ...data,
    chosenFilterType,
    next: {
      text: translate('commands.utils.filters.promptAdd', { type: chosenFilterType })
    }
  }
}

async function inputFilterFn (m, data) {
  const { profile, feed, role, user, target, chosenFilterType } = data
  const input = m.content
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const locale = profile ? profile.locale : undefined
  const translator = new Translator(locale)
  const translate = translator.translate.bind(translator)

  const addList = input.trim().split('\n').map(item => item.trim().toLowerCase()).filter((item, index, self) => item && index === self.indexOf(item)) // Valid items to be added, trimmed and lowercased
  let addedList = '' // Valid items that were added
  let invalidItems = '' // Invalid items that were not added
  let add = []

  for (const item of addList) {
    if (target.getFilterIndex(chosenFilterType, item) === -1) {
      addedList += `\n${item}`
      add.push(item)
    } else {
      invalidItems += `\n${item}`
    }
  }

  if (add.length > 0) {
    await target.addFilters(chosenFilterType, add)
  }

  if (!user && !role) {
    log.command.info(`New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${feed.url}`, m.guild)
    let msg = ''
    if (addedList) {
      msg = `${translate('commands.utils.filters.addSuccess')} \`${chosenFilterType}\`:\n\`\`\`\n\n${addedList}\`\`\``
    }
    if (invalidItems) {
      msg += `\n${translate('commands.utils.filters.addFailed')}:\n\`\`\`\n\n${invalidItems}\`\`\``
    }
    if (addedList) {
      msg += translate('commands.utils.filters.testFilters', { prefix })
    }
    await m.channel.send(`${msg}\n\n${translate('generics.backupReminder', { prefix })}`)
  } else {
    log.command.info(`New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${feed.url}.`, m.guild, user || role)
    let msg = `${translate('commands.utils.filters.updatedFor', {
      name: user ? `${user.username}#${user.discriminator}` : role.name
    })} ${translate('commands.utils.filters.addSuccess')} \`${chosenFilterType}\`:\n\`\`\`\n\n${addedList}\`\`\``
    if (invalidItems) {
      msg += `\n${translate('commands.utils.filters.addFailed')}:\n\`\`\`\n\n${invalidItems}\`\`\``
    }
    if (addedList) {
      msg += translate('commands.utils.filters.testFiltersSubscriber', { prefix })
    }
    await m.channel.send(`${msg}\n\n${translate('generics.backupReminder', { prefix })}`)
  }

  return { __end: true }
}

exports.add = async (message, profile, feed, role, user) => {
  const locale = profile ? profile.locale : undefined
  const selectCategory = new MenuUtils.Menu(message, selectCategoryFn, { numbered: false })
  const inputFilter = new MenuUtils.Menu(message, inputFilterFn)
  const translator = new Translator(locale)
  const translate = translator.translate.bind(translator)

  const targetId = role ? role.id : user ? user.id : undefined
  const targetName = role ? role.name : user ? user.username : undefined
  const targetType = role ? translate('commands.utils.filters.role') : user ? translate('commands.utils.filters.user') : undefined
  let target
  if (targetId) {
    const subscribers = await feed.getSubscribers()
    target = subscribers.find(sub => sub.id === targetId)
    if (!target) {
      target = new Subscriber({
        feed: feed._id,
        type: targetType.toLowerCase(),
        id: targetId
      })
    }
  } else {
    target = feed
  }

  // Select the correct filter list, whether if it's for a role's filtered subscription or feed filters. null role = not adding filter for role
  const options = filterTypes.map(item => ({ title: item.show, description: '\u200b' }))

  const data = {
    profile,
    feed,
    role,
    user,
    target,
    next: {
      embed: {
        title: translate('commands.utils.filters.filtersCustomization'),
        description: `**${translate('commands.utils.filters.feed')}:** ${feed.url}${targetId ? `\n**${targetType}:** ${targetName}` : ''}\n\n${translate('commands.utils.filters.categoryDescription')}`,
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
  const { profile } = data
  const locale = profile ? profile.locale : undefined
  const translator = new Translator(locale)
  const translate = translator.translate.bind(translator)
  let chosenFilterType = ''

  if (input.startsWith('raw:') || input.startsWith('other:')) {
    chosenFilterType = input
  } else {
    chosenFilterType = filterTypes.find(type => type.use === input.toLowerCase())
    if (chosenFilterType) {
      chosenFilterType = chosenFilterType.use
    }
  }

  if (!chosenFilterType) {
    throw new MenuUtils.MenuOptionError(translate('commands.utils.filters.invalidCategory'))
  }
  // else if (typeof filterList[chosenFilterType] === 'string') {
  //   await m.channel.send(translate('commands.utils.filters.regexExists', { category: chosenFilterType }))
  //   return { __end: true }
  // }

  return {
    ...data,
    chosenFilterType,
    next: {
      text: translate('commands.utils.filters.removeFilterConfirm', { category: chosenFilterType }),
      embed: null
    }
  }
}

async function removeFilterFn (m, data) {
  const { profile, feed, role, user, chosenFilterType, target } = data
  const locale = profile ? profile.locale : undefined
  const translator = new Translator(locale)
  const translate = translator.translate.bind(translator)
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  // Select the word/phrase filter here from that filter category
  const removeList = m.content.trim().split('\n').map(item => item.trim()).filter((item, index, self) => item && index === self.indexOf(item)) // Items to be removed
  let validItems = ''
  let invalidItems = '' // Invalid items that could not be removed

  let remove = []
  for (const item of removeList) {
    const index = target.getFilterIndex(chosenFilterType, item)
    if (index === -1) {
      invalidItems += `\n${item}`
    } else {
      validItems += `\n${item}`
      remove.push(item)
    }
  }

  await target.removeFilters(chosenFilterType, remove)

  if (!user && !role) {
    let msg = `${translate('commands.utils.filters.removeSuccess')} \`${chosenFilterType}\`:\`\`\`\n\n${validItems}\`\`\``
    if (invalidItems) {
      msg += `\n\n${translate('commands.utils.filters.removeFailedNoExist')}:\n\`\`\`\n\n${invalidItems}\`\`\``
    }
    log.command.info(`Removed filter(s) [${validItems.trim().split('\n')}] from '${chosenFilterType}' for ${feed.url}`, m.guild)
    await m.channel.send(`${msg}\n\n${translate('generics.backupReminder', { prefix })}`)
  } else {
    let msg = `${translate('commands.utils.filters.removeSuccessSubscriber', { name: user ? `${user.username}#${user.discriminator}` : role.name })} \`${chosenFilterType}\`:\`\`\`\n\n${validItems}\`\`\``
    if (invalidItems) {
      msg += `\n\n${translate('commands.utils.filters.removeFailedNoExist')}:\n\`\`\`\n\n${invalidItems}\`\`\``
    }
    log.command.info(`Removed ${user ? 'user' : 'role'} filter(s) [${validItems.trim().split('\n')}] from '${chosenFilterType}' for ${feed.url}`, m.guild, user || role)
    await m.channel.send(`${msg}\n\n${translate('generics.backupReminder', { prefix })}`)
  }
  return { __end: true }
}

exports.remove = async (message, profile, feed, role, user) => {
  const locale = profile ? profile.locale : undefined
  const translator = new Translator(locale)
  const translate = translator.translate.bind(translator)
  let target
  const targetId = role ? role.id : user ? user.id : undefined

  if (targetId) {
    const subscribers = await feed.getSubscribers()
    target = subscribers.find(sub => sub.id === targetId)
  } else {
    target = feed
  }

  const selectCategory = new MenuUtils.Menu(message, filterRemoveCategory, { numbered: false })
  const removeFilter = new MenuUtils.Menu(message, removeFilterFn)

  if (!target || !target.hasFilters()) {
    return message.channel.send(translate('commands.utils.filters.removeNone', { link: feed.url }))
      .catch(err => log.command.warning(`filterRemove 1`, message.guild, err))
  }

  const options = []
  const filterList = target.filters

  for (const filterCategory in filterList) {
    const filters = filterList[filterCategory]
    let value = ''
    for (const filter of filters) {
      value += `${filter}\n`
    }
    options.push({
      title: filterCategory,
      description: value,
      inline: true
    })
  }

  const data = {
    profile,
    feed,
    role,
    user,
    target,
    next: {
      embed: {
        author: { text: translate('commands.utils.filters.listOfFilters') },
        description: translate('commands.utils.filters.listOfFiltersDescription', { title: feed.title, link: feed.url }),
        options: options
      }
    }
  }

  return new MenuUtils.MenuSeries(message, [selectCategory, removeFilter], data)
}

// END REMOVE FUNCTIONS

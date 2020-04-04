const getConfig = require('../config.js').get
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const Subscriber = require('../structs/db/Subscriber.js')
const Translator = require('../structs/Translator.js')
const createLogger = require('../util/logger/create.js')
const properties = [
  'format',
  'filters',
  'misc-options',
  'subscribers',
  'comparisons',
  'all'
]

async function destSelectorFn (m, data) {
  const { feed, selectedFeeds, locale } = data
  const cloned = []
  if (data.cloneFormat) cloned.push('format')
  if (data.cloneFilters) cloned.push('filters')
  if (data.cloneMiscOptions) cloned.push('misc-options')
  if (data.cloneSubscribers) cloned.push('subscribers')
  if (data.cloneComparisons) cloned.push('comparisons')

  return {
    ...data,
    clonedProps: cloned,
    next: {
      text: Translator.translate('commands.clone.confirm', locale, {
        link: feed.url,
        cloning: cloned.join('`, `'),
        destinations: selectedFeeds.map(selected => `${selected.url}\n`).join().trim()
      })
    }
  }
}

async function confirmFn (m, data) {
  if (m.content !== 'yes') {
    throw new MenuUtils.MenuOptionError(Translator.translate('commands.clone.confirmError', data.locale))
  }
  return {
    ...data,
    confirmed: true
  }
}

module.exports = async (message, command) => {
  const profile = await Profile.get(message.guild.id)
  const guildLocale = profile ? profile.locale : undefined
  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const translate = Translator.createLocaleTranslator(guildLocale)
  const sourceSelector = new FeedSelector(message, undefined, {
    command,
    locale: guildLocale,
    prependDescription: translate('commands.clone.copyFrom'),
    globalSelect: true
  }, feeds)
  const destSelector = new FeedSelector(message, destSelectorFn, {
    command,
    locale: guildLocale,
    prependDescription: translate('commands.clone.copyTo'),
    multiSelect: true,
    globalSelect: true
  }, feeds)
  const confirm = new MenuUtils.Menu(message, confirmFn, {
    splitOptions: {
      prepend: '```',
      append: '```'
    }
  })
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const args = MenuUtils.extractArgsAfterCommand(message.content)
  if (args.length === 0) {
    return message.channel.send(translate('commands.clone.noProperties', {
      prefix,
      properties: properties.join('`, `')
    }))
  }
  const invalidArgs = []
  for (const arg of args) {
    if (!properties.includes(arg)) {
      invalidArgs.push(arg)
    }
  }
  if (invalidArgs.length > 0) {
    return message.channel.send(translate('commands.clone.invalidProperties', {
      invalid: invalidArgs.join('`, `'),
      properties: properties.join('`, `')
    }))
  }

  const cloneAll = args.includes('all')
  const cloneFilters = cloneAll || args.includes('filters')
  const cloneMiscOptions = cloneAll || args.includes('misc-options')
  const cloneFormat = cloneAll || args.includes('format')
  const cloneSubscribers = cloneAll || args.includes('subscribers')
  const cloneComparisons = cloneAll || args.includes('comparisons')

  const data = await new MenuUtils.MenuSeries(message, [sourceSelector, destSelector, confirm], {
    cloneFormat,
    cloneFilters,
    cloneMiscOptions,
    cloneSubscribers,
    cloneComparisons,
    locale: guildLocale
  }).start()

  if (!data || !data.confirmed) return
  /** @type {Feed} */
  const feed = data.feed

  /** @type {Feed[]} */
  const selectedFeeds = data.selectedFeeds

  const log = createLogger(message.guild.shard.id)
  log.info({
    guild: message.guild
  }, `Properties ${data.clonedProps.join(',')} for the feed ${feed.url} cloning to to ${selectedFeeds.length} feeds`)

  const copyFromSubscribers = await feed.getSubscribers()

  for (const selected of selectedFeeds) {
    let updateSelected = false
    // Filters
    if (cloneFilters) {
      selected.filters = feed.filters
      updateSelected = true
    }

    // Misc Options
    if (cloneMiscOptions) {
      selected.checkDates = feed.checkDates
      selected.formatTables = feed.formatTables
      selected.imgLinksExistence = feed.imgLinksExistence
      selected.imgPreviews = feed.imgPreviews
      selected.toggleRoleMentions = feed.toggleRoleMentions
      updateSelected = true
    }

    // Format
    if (cloneFormat) {
      selected.text = feed.text
      selected.embeds = feed.embeds
      updateSelected = true
    }

    // Comparisons
    if (cloneComparisons) {
      selected.ncomparisons = feed.ncomparisons
      selected.pcomparisons = feed.pcomparisons
      updateSelected = true
    }

    if (updateSelected) {
      await selected.save()
    }

    // Subscribers
    if (cloneSubscribers) {
      // Delete the selected feed's subscribers
      const subscribers = await selected.getSubscribers()
      const deletions = []
      for (const subscriber of subscribers) {
        deletions.push(subscriber.delete())
      }
      await Promise.all(deletions)
      // Save the new ones
      const saves = []
      for (const copyFromSubscriber of copyFromSubscribers) {
        const data = copyFromSubscriber.toJSON()
        data.feed = selected._id
        const newSubscriber = new Subscriber(data)
        saves.push(newSubscriber.save())
      }
      await Promise.all(saves)
    }
  }

  await message.channel.send(`${translate('commands.clone.success', {
    cloned: data.clonedProps.join('`, `'),
    link: feed.url,
    destinationCount: selectedFeeds.length
  })} ${translate('generics.backupReminder', { prefix })}`)
}

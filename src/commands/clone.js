const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const Format = require('../structs/db/Format.js')
const Subscriber = require('../structs/db/Subscriber.js')

const Translator = require('../structs/Translator.js')
const properties = [`format`, `filters`, `misc-options`, `subscribers`, 'all']

async function destSelectorFn (m, data) {
  const { feed, selectedFeeds, locale } = data
  const cloned = []
  if (data.cloneFormat) cloned.push('format')
  if (data.cloneFilters) cloned.push('filters')
  if (data.cloneMiscOptions) cloned.push('misc-options')
  if (data.cloneSubscribers) cloned.push('subscribers')

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

module.exports = async (bot, message, command) => {
  try {
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
    const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
    const args = MenuUtils.extractArgsAfterCommand(message.content)
    if (args.length === 0) {
      return await message.channel.send(translate('commands.clone.noProperties', {
        prefix,
        properties: properties.join('`, `')
      }))
    }
    let invalidArgs = []
    for (const arg of args) {
      if (!properties.includes(arg)) {
        invalidArgs.push(arg)
      }
    }
    if (invalidArgs.length > 0) {
      return await message.channel.send(translate('commands.clone.invalidProperties', { invalid: invalidArgs.join('`, `'), properties: properties.join('`, `') }))
    }

    const cloneAll = args.includes('all')
    const cloneFilters = cloneAll || args.includes('filters')
    const cloneMiscOptions = cloneAll || args.includes('misc-options')
    const cloneFormat = cloneAll || args.includes('format')
    const cloneSubscribers = cloneAll || args.includes('subscribers')

    const data = await new MenuUtils.MenuSeries(message, [sourceSelector, destSelector, confirm], {
      cloneFormat,
      cloneFilters,
      cloneMiscOptions,
      cloneSubscribers,
      locale: guildLocale
    }).start()

    if (!data || !data.confirmed) return
    /** @type {Feed} */
    const feed = data.feed

    /** @type {Feed[]} */
    const selectedFeeds = data.selectedFeeds

    log.command.info(`Properties ${data.clonedProps.join(',')} for the feed ${feed.url} cloning to to ${selectedFeeds.length} feeds`, message.guild)

    const copyFromFormat = await feed.getFormat()
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
        selected.checkTitles = feed.checkTitles
        selected.checkDates = feed.checkDates
        selected.formatTables = feed.formatTables
        selected.imgLinksExistence = feed.imgLinksExistence
        selected.imgPreviews = feed.imgPreviews
        selected.toggleRoleMentions = feed.toggleRoleMentions
        updateSelected = true
      }

      if (updateSelected) {
        await selected.save()
      }

      // Format
      if (cloneFormat) {
        const format = await selected.getFormat()
        if (format) {
          await format.delete()
        }
        if (copyFromFormat) {
          const data = copyFromFormat.toJSON()
          data.feed = selected._id
          const clonedFormat = new Format(data)
          await clonedFormat.save()
        }
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
  } catch (err) {
    log.command.warning(`rssclone`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssclone 1', message.guild, err))
  }
}

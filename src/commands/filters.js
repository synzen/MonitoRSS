const log = require('../util/logger.js')
const VALID_OPTIONS = ['1', '2', '3', '4', '5']
const filters = require('./util/filters.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const FailCounter = require('../structs/db/FailCounter.js')
const Format = require('../structs/db/Format.js')
const Subscriber = require('../structs/db/Subscriber.js')
const FilteredFormat = require('../structs/db/FilteredFormat.js')

async function feedSelectorFn (m, data) {
  const { feed, locale } = data

  return {
    ...data,
    next: {
      embed: {
        description: Translator.translate('commands.filters.selectFeedDescription', locale, {
          title: feed.title,
          link: feed.url
        }) }
    }
  }
}

async function setMessageFn (m, data) {
  const { profile, feed } = data
  const input = m.content
  if (!VALID_OPTIONS.includes(input)) {
    throw new MenuUtils.MenuOptionError()
  }

  if (input === '1') {
    return {
      ...data,
      next: {
        series: await filters.add(m, profile, feed)
      }
    }
  } else if (input === '2') {
    return {
      ...data,
      next: {
        series: await filters.remove(m, profile, feed)
      }
    }
  } else if (input === '3' || input === '4' || input === '5') {
    if (!feed.hasFilters()) {
      return {
        ...data,
        selectedOption: input,
        noFilters: true
      }
    }
    return {
      ...data,
      selectedOption: input
    }
  }
}

module.exports = async (bot, message, command, role) => {
  try {
    const profile = await Profile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command, locale: guildLocale }, feeds)
    const setMessage = new MenuUtils.Menu(message, setMessageFn)
      .setAuthor(translate('commands.filters.feedFiltersCustomization'))
      .addOption(translate('commands.filters.optionAddFilters'), translate('commands.filters.optionAddFiltersDescription'))
      .addOption(translate('commands.filters.optionRemoveFilters'), translate('commands.filters.optionRemoveFiltersDescription'))
      .addOption(translate('commands.filters.optionRemoveAllFilters'), translate('commands.filters.optionRemoveAllFiltersDescription'))
      .addOption(translate('commands.filters.optionListFilters'), translate('commands.filters.optionListFiltersDescription'))
      .addOption(translate('commands.filters.optionSendArticle'), translate('commands.filters.optionSendArticleDescription'))

    const data = await new MenuUtils.MenuSeries(message, [feedSelector, setMessage], { locale: guildLocale, profile }).start()
    if (!data) {
      return
    }
    const { selectedOption, feed } = data

    if (!selectedOption) {
      return // Option 1/2 was selected instead of 3/4/5
    }

    if (selectedOption === '3') {
      await feed.removeAllFilters()
      log.command.info(`Removed all filters from ${feed.url}`, message.guild)
      return await message.channel.send(translate('commands.filters.removedAllSuccess', { link: feed.url }))
    } else if (selectedOption === '4') { // 4 = List all existing filters
      if (!feed.hasFilters()) {
        return await message.channel.send(`There are no filters assigned to ${feed.url}`)
      }
      const list = new MenuUtils.Menu(message, undefined, { numbered: false })
      list
        .setAuthor(translate('commands.filters.listFilters'))
        .setDescription(translate('commands.filters.listFiltersDescription', { title: feed.title, link: feed.url }))

      // Generate the list of filters assigned to a feed and add to embed to be sent
      for (const filterCat in feed.filters) {
        const filterContent = feed.filters[filterCat]
        let value = ''
        filterContent.forEach((filter) => {
          value += `${filter}\n`
        })
        list.addOption(filterCat, value, true)
      }

      return await list.send(undefined)
    } else if (selectedOption === '5') { // 5 = Send passing article
      if (data.noFilters) {
        return await message.channel.send(translate('commands.filters.noFilters', { link: feed.url }))
      }
      if (await FailCounter.hasFailed(feed.url)) {
        return await message.channel.send(translate('commands.filters.connectionFailureLimit'))
      }
      const filters = feed.hasRFilters() ? feed.rfilters : feed.filters
      const article = await FeedFetcher.fetchRandomArticle(feed.url, filters)
      if (!article) {
        return await message.channel.send(translate('commands.filters.noArticlesPassed'))
      }
      log.command.info(`Sending filtered article for ${feed.url}`, message.guild)
      const [ format, subscribers, filteredFormats ] = await Promise.all([
        Format.getBy('feed', feed._id),
        Subscriber.getManyBy('feed', feed._id),
        FilteredFormat.getManyBy('feed', feed._id)
      ])
      article._delivery = {
        rssName: feed._id,
        source: {
          ...feed.toJSON(),
          format: format ? format.toJSON() : undefined,
          filteredFormats: filteredFormats.map(f => f.toJSON()),
          subscribers: subscribers.map(s => s.toJSON()),
          dateSettings: profile
            ? {
              timezone: profile.timezone,
              format: profile.dateFormat,
              language: profile.dateLanguage
            }
            : {}
        }
      }

      const queue = new ArticleMessageQueue(message.client)
      await queue.enqueue(article, true, true)
      await queue.send(message.client)
    }
  } catch (err) {
    log.command.warning(`rssfilters`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssfilters 1', message.guild, err))
  }
}

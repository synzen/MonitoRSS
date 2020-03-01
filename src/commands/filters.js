const VALID_OPTIONS = ['1', '2', '3', '4', '5']
const filters = require('./util/filters.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FeedData = require('../structs/FeedData.js')
const FailRecord = require('../structs/db/FailRecord.js')
const createLogger = require('../util/logger/create.js')

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

module.exports = async (message, command, role) => {
  const profile = await Profile.get(message.guild.id)
  const guildLocale = profile ? profile.locale : undefined
  const feedDatas = await FeedData.getManyBy('guild', message.guild.id)
  const feeds = feedDatas.map(data => data.feed)
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

  const log = createLogger(message.guild.shard.id)

  if (selectedOption === '3') {
    await feed.removeAllFilters()
    log.info({
      guild: message.guild
    }, `Removed all filters from ${feed.url}`)
    return message.channel.send(translate('commands.filters.removedAllSuccess', { link: feed.url }))
  } else if (selectedOption === '4') { // 4 = List all existing filters
    if (!feed.hasFilters()) {
      return message.channel.send(`There are no filters assigned to ${feed.url}`)
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

    return list.send(undefined)
  } else if (selectedOption === '5') { // 5 = Send passing article
    if (data.noFilters) {
      return message.channel.send(translate('commands.filters.noFilters', { link: feed.url }))
    }
    if (await FailRecord.hasFailed(feed.url)) {
      return message.channel.send(translate('commands.filters.connectionFailureLimit'))
    }
    const filters = feed.hasRFilters() ? feed.rfilters : feed.filters
    const article = await FeedFetcher.fetchRandomArticle(feed.url, filters)
    if (!article) {
      return message.channel.send(translate('commands.filters.noArticlesPassed'))
    }
    log.info({
      guild: message.guild
    }, `Sending filtered article for ${feed.url}`)
    article._feed = feedDatas.find(data => data.feed._id === feed._id).toJSON()

    const queue = new ArticleMessageQueue(message.client)
    await queue.enqueue(article, true)
    await queue.send(message.client)
  }
}

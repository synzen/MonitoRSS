const log = require('../util/logger.js')
const VALID_OPTIONS = ['1', '2', '3', '4', '5']
const filters = require('./util/filters.js')
const dbOpsVips = require('../util/db/vips.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Feed = require('../structs/db/Feed.js')

async function feedSelectorFn (m, data) {
  const { feed, locale } = data

  return {
    ...data,
    next: {
      embed: {
        description: Translator.translate('commands.rssfilters.selectFeedDescription', locale, { title: feed.title, link: feed.url }) }
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
    const profile = await GuildProfile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command, locale: guildLocale }, feeds)
    const setMessage = new MenuUtils.Menu(message, setMessageFn)
      .setAuthor(translate('commands.rssfilters.feedFiltersCustomization'))
      .addOption(translate('commands.rssfilters.optionAddFilters'), translate('commands.rssfilters.optionAddFiltersDescription'))
      .addOption(translate('commands.rssfilters.optionRemoveFilters'), translate('commands.rssfilters.optionRemoveFiltersDescription'))
      .addOption(translate('commands.rssfilters.optionRemoveAllFilters'), translate('commands.rssfilters.optionRemoveAllFiltersDescription'))
      .addOption(translate('commands.rssfilters.optionListFilters'), translate('commands.rssfilters.optionListFiltersDescription'))
      .addOption(translate('commands.rssfilters.optionSendArticle'), translate('commands.rssfilters.optionSendArticleDescription'))

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
      return await message.channel.send(translate('commands.rssfilters.removedAllSuccess', { link: feed.url }))
    } else if (selectedOption === '4') { // 4 = List all existing filters
      if (!feed.hasFilters()) {
        return await message.channel.send(`There are no filters assigned to ${feed.url}`)
      }
      const list = new MenuUtils.Menu(message, undefined, { numbered: false })
      list
        .setAuthor(translate('commands.rssfilters.listFilters'))
        .setDescription(translate('commands.rssfilters.listFiltersDescription', { title: feed.title, link: feed.url }))

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
        return await message.channel.send(translate('commands.rssfilters.noFilters', { link: feed.url }))
      }
      const failedLinkResult = await dbOpsFailedLinks.get(feed.url)
      if (failedLinkResult && failedLinkResult.failed) {
        return await message.channel.send(translate('commands.rssfilters.connectionFailureLimit'))
      }
      const article = await FeedFetcher.fetchRandomArticle(feed.url, feed.filters)
      if (!article) {
        return await message.channel.send(translate('commands.rssfilters.noArticlesPassed'))
      }
      log.command.info(`Sending filtered article for ${feed.url}`, message.guild)
      article._delivery = {
        rssName: feed._id,
        source: {
          ...feed.toObject(),
          dateSettings: {
            timezone: feed.timezone,
            format: feed.dateFormat,
            language: feed.dateLanguage
          }
        }
      }
      if (feed.webhook && !(await dbOpsVips.isVipServer(message.guild.id))) {
        log.general.warning('Illegal webhook detected for non-vip user', message.guild, message.author)
        feed.webhook = undefined
      }

      const queue = new ArticleMessageQueue()
      await queue.enqueue(article, true, true)
      await queue.send(message.client)
    }
  } catch (err) {
    log.command.warning(`rssfilters`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssfilters 1', message.guild, err))
  }
}

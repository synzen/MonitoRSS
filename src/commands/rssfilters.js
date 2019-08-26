const log = require('../util/logger.js')
const VALID_OPTIONS = ['1', '2', '3', '4', '5']
const filters = require('./util/filters.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const dbOpsVips = require('../util/db/vips.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const Translator = require('../structs/Translator')
const storage = require('../util/storage.js')

async function feedSelectorFn (m, data) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]

  return { guildRss: guildRss,
    rssName: rssName,
    next: {
      embed: {
        description: Translator.translate('commands.rssfilters.selectFeedDescription', guildRss.locale, { title: source.title, link: source.link }) }
    }
  }
}

async function setMessage (m, data) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const input = m.content
  if (!VALID_OPTIONS.includes(input)) throw new MenuUtils.MenuOptionError()

  if (input === '1') return { guildRss: guildRss, rssName: rssName, next: { series: filters.add(m, guildRss, rssName) } }
  else if (input === '2') return { guildRss: guildRss, rssName: rssName, next: { series: filters.remove(m, guildRss, rssName) } }
  else if (input === '3' || input === '4' || input === '5') {
    const foundFilters = []
    if (typeof source.filters === 'object') {
      for (var prop in source.filters) { if (source.filters.hasOwnProperty(prop) && prop !== 'roleSubscriptions') foundFilters.push(prop) }
    }

    if (foundFilters.length === 0) return { selectedOption: input, guildRss: guildRss, rssName: rssName, noFilters: true }
    return { selectedOption: input, guildRss: guildRss, rssName: rssName }
  }
}

module.exports = async (bot, message, command, role) => {
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const guildLocale = guildRss ? guildRss.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command }, guildRss)
    const messagePrompt = new MenuUtils.Menu(message, setMessage)
      .setAuthor(translate('commands.rssfilters.feedFiltersCustomization'))
      .addOption(translate('commands.rssfilters.optionAddFilters'), translate('commands.rssfilters.optionAddFiltersDescription'))
      .addOption(translate('commands.rssfilters.optionRemoveFilters'), translate('commands.rssfilters.optionRemoveFiltersDescription'))
      .addOption(translate('commands.rssfilters.optionRemoveAllFilters'), translate('commands.rssfilters.optionRemoveAllFiltersDescription'))
      .addOption(translate('commands.rssfilters.optionListFilters'), translate('commands.rssfilters.optionListFiltersDescription'))
      .addOption(translate('commands.rssfilters.optionSendArticle'), translate('commands.rssfilters.optionSendArticleDescription'))

    const data = await new MenuUtils.MenuSeries(message, [feedSelector, messagePrompt], { locale: guildLocale }).start()
    if (!data) return
    const { selectedOption, rssName } = data

    if (!selectedOption) return // Option 1/2 was selected instead of 3/4/5
    const source = guildRss.sources[rssName]
    const filterList = source.filters

    if (selectedOption === '3') {
      delete source.filters
      await dbOpsGuilds.update(guildRss)
      log.command.info(`Removed all filters from ${source.link}`, message.guild)
      return await message.channel.send(translate('commands.rssfilters.removedAllSuccess', { link: source.link }))
    } else if (selectedOption === '4') { // 4 = List all existing filters
      if (!filterList) {
        return await message.channel.send(`There are no filters assigned to ${source.link}`)
      }
      const list = new MenuUtils.Menu(message, undefined, { numbered: false })
      list
        .setAuthor(translate('commands.rssfilters.listFilters'))
        .setDescription(translate('commands.rssfilters.listFiltersDescription', { title: source.title, link: source.link }))

      // Generate the list of filters assigned to a feed and add to embed to be sent
      for (const filterCat in filterList) {
        const filterContent = filterList[filterCat]
        let value = ''
        if (typeof filterContent === 'string') {
          value = `\`\`\`${filterContent}\`\`\``
        } else {
          for (const filter in filterList[filterCat]) {
            value += `${filterList[filterCat][filter]}\n`
          }
        }
        list.addOption(filterCat, value, true)
      }

      return await list.send(undefined)
    } else if (selectedOption === '5') { // 5 = Send passing article
      if (data.noFilters) return await message.channel.send(translate('commands.rssfilters.noFilters', { link: source.link }))
      const failedLinkResult = await dbOpsFailedLinks.get(source.link)
      if (failedLinkResult && failedLinkResult.failed) {
        return await message.channel.send(translate('commands.rssfilters.connectionFailureLimit'))
      }
      const article = await FeedFetcher.fetchRandomArticle(source.link, guildRss.sources[rssName].filters)
      if (!article) {
        return await message.channel.send(translate('commands.rssfilters.noArticlesPassed'))
      }
      log.command.info(`Sending filtered article for ${source.link}`, message.guild)
      article._delivery = {
        rssName,
        channelId: message.channel.id,
        dateSettings: {
          timezone: guildRss.timezone,
          format: guildRss.dateFormat,
          language: guildRss.dateLanguage
        }
      }
      if (source.webhook && !(await dbOpsVips.isVipServer(message.guild.id))) {
        log.general.warning('Illegal webhook detected for non-vip user', message.guild, message.author)
        delete guildRss.sources[rssName].webhook
      }
      article._delivery.source = guildRss.sources[rssName]

      const queue = new ArticleMessageQueue()
      await queue.enqueue(article, true, true)
      await queue.send(storage.bot)
    }
  } catch (err) {
    log.command.warning(`rssfilters`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssfilters 1', message.guild, err))
  }
}

const filters = require('./util/filters.js')
const dbOps = require('../util/dbOps.js')
const getArticle = require('../rss/getArticle.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const log = require('../util/logger.js')
const VALID_OPTIONS = ['1', '2', '3', '4', '5']
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')

async function feedSelectorFn (m, data) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]

  return { guildRss: guildRss,
    rssName: rssName,
    next: {
      embed: {
        description: `**Feed Title:** ${source.title}\n**Feed Link:** ${source.link}\n\nSelect an option by typing its number, or type *exit* to cancel. Only messages that contain any of the words defined in these feed filters will be sent to Discord.\u200b\n\u200b\n` }
    }
  }
}

async function setMessage (m, data) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const input = m.content
  if (!VALID_OPTIONS.includes(input)) throw new SyntaxError('That is not a valid choice. Try again, or type `exit` to cancel.')

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
    const guildRss = await dbOps.guildRss.get(message.guild.id)
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command }, guildRss)
    const messagePrompt = new MenuUtils.Menu(message, setMessage)
      .setAuthor('Feed Filters Customization')
      .addOption(`Add feed filter(s)`, `Add new filter(s) to a specific category in a feed.`)
      .addOption(`Remove feed filter(s)`, `Remove existing filter(s), if any.`)
      .addOption(`Remove all feed filter(s)`, `Remove all filters, if any.`)
      .addOption(`List existing filter(s)`, `List all filters in all categories, if any.`)
      .addOption(`Send passing article`, `Send a randomly chosen article that passes currently specified filters.`)

    const data = await new MenuUtils.MenuSeries(message, [feedSelector, messagePrompt]).start()
    if (!data) return
    const { selectedOption, rssName } = data

    if (!selectedOption) return // Option 1/2 was selected instead of 3/4/5
    const source = guildRss.sources[rssName]
    const filterList = source.filters

    if (selectedOption === '3') {
      for (var filterCategory in filterList) {
        if (filterCategory !== 'roleSubscriptions') delete filterList[filterCategory]
      }
      if (Object.keys(filterList).length === 0) delete source.filters

      log.command.info(`Removing all filters from ${source.link}`, message.guild)
      await dbOps.guildRss.update(guildRss)
      return await message.channel.send(`All feed filters have been successfully removed from <${source.link}>.`)
    } else if (selectedOption === '4') { // 4 = List all existing filters
      if (!filterList || (filterList && Object.keys(filterList).length === 1 && filterList.roleSubscriptions !== undefined)) return await message.channel.send(`There are no filters assigned to ${source.link}`)
      const list = new MenuUtils.Menu(message, undefined, { numbered: false })
      list.setAuthor('List of Assigned Filters')
        .setDescription(`**Feed Title:** ${source.title}\n**Feed Link:** ${source.link}\n\nBelow are the filter categories with their words/phrases under each.\u200b\n\u200b\n`)

      // Generate the list of filters assigned to a feed and add to embed to be sent
      for (var filterCat in filterList) {
        let value = ''
        if (filterCat !== 'roleSubscriptions') {
          for (var filter in filterList[filterCat]) { value += `${filterList[filterCat][filter]}\n` }
        }
        list.addOption(filterCat, value, true)
      }

      return await list.send(undefined)
    } else if (selectedOption === '5') { // 5 = Send passing article
      if (data.noFilters) return await message.channel.send(`There are no filters assigned to ${source.link}`)
      const [ article ] = await getArticle(guildRss, rssName, true)
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
      if (source.webhook && !(await dbOps.vips.isVipServer(message.guild.id))) {
        log.general.warning('Illegal webhook detected for non-vip user', message.guild, message.author)
        delete guildRss.sources[rssName].webhook
      }
      article._delivery.source = guildRss.sources[rssName]

      const queue = new ArticleMessageQueue()
      await queue.send(article, true, true)
      queue.sendDelayed()
    }
  } catch (err) {
    log.command.warning(`rssfilters`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssfilters 1', message.guild, err))
  }
}

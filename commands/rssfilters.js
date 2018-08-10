const filters = require('./util/filters.js')
const dbOps = require('../util/dbOps.js')
const getArticle = require('../rss/getArticle.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const log = require('../util/logger.js')
const VALID_OPTIONS = ['1', '2', '3', '4', '5']
const ArticleMessage = require('../structs/ArticleMessage.js')

function feedSelectorFn (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]

  callback(null, { guildRss: guildRss,
    rssName: rssName,
    next: {
      embed: {
        description: `**Feed Title:** ${source.title}\n**Feed Link:** ${source.link}\n\nSelect an option by typing its number, or type *exit* to cancel. Only messages that contain any of the words defined in these feed filters will be sent to Discord.\u200b\n\u200b\n`}
    }
  })
}

function setMessage (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const input = m.content
  if (!VALID_OPTIONS.includes(input)) return callback(new SyntaxError('That is not a valid choice. Try again, or type `exit` to cancel.'))

  if (input === '1') callback(null, { guildRss: guildRss, rssName: rssName, next: { series: filters.add(m, guildRss, rssName) } }) // filters.add(m, rssName, null, msgHandler)
  else if (input === '2') callback(null, { guildRss: guildRss, rssName: rssName, next: { series: filters.remove(m, guildRss, rssName) } }) // filters.remove(m, rssName, null, msgHandler)
  else if (input === '3' || input === '4' || input === '5') {
    const foundFilters = []
    if (typeof source.filters === 'object') {
      for (var prop in source.filters) { if (source.filters.hasOwnProperty(prop) && prop !== 'roleSubscriptions') foundFilters.push(prop) }
    }

    if (foundFilters.length === 0) return callback(new Error(`There are no filters assigned to <${source.link}>.`))
    callback(null, { selectedOption: input, guildRss: guildRss, rssName: rssName })
  }
}

module.exports = (bot, message, command, role) => {
  const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command })
  const messagePrompt = new MenuUtils.Menu(message, setMessage)
    .setAuthor('Feed Filters Customization')
    .addOption(`Add feed filter(s)`, `Add new filter(s) to a specific category in a feed.`)
    .addOption(`Remove feed filter(s)`, `Remove existing filter(s), if any.`)
    .addOption(`Remove all feed filter(s)`, `Remove all filters, if any.`)
    .addOption(`List existing filter(s)`, `List all filters in all categories, if any.`)
    .addOption(`Send passing article`, `Send a randomly chosen article that passes currently specified filters.`)

  new MenuUtils.MenuSeries(message, [feedSelector, messagePrompt]).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)

      const { selectedOption, guildRss, rssName } = data

      if (!selectedOption) return // Option 1/2 was selected instead of 3/4/5
      const source = guildRss.sources[rssName]
      const filterList = source.filters

      if (selectedOption === '3') {
        for (var filterCategory in filterList) {
          if (filterCategory !== 'roleSubscriptions') delete filterList[filterCategory]
        }
        if (Object.keys(filterList).length === 0) delete source.filters
        dbOps.guildRss.update(guildRss)
        return await message.channel.send(`All feed filters have been successfully removed from <${source.link}>.`)
      } else if (selectedOption === '4') { // 4 = List all existing filters
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

        return list.send(undefined, err => {
          if (err) return err.code === 50013 ? null : message.channel.send(err.message).catch(err => log.general.warning('rssfilters 1', message.guild, err))
        })
      } else if (selectedOption === '5') { // 5 = Send passing article
        getArticle(guildRss, rssName, true, (err, article) => {
          if (err) {
            let channelErrMsg = ''
            switch (err.type) {
              case 'failedLink':
                channelErrMsg = 'Reached fail limit. Please use `rssrefresh` to try validate again'
                break
              case 'request':
                channelErrMsg = 'Unable to connect to feed link'
                break
              case 'feedparser':
                channelErrMsg = 'Invalid feed'
                break
              case 'database':
                channelErrMsg = 'Internal database error. Try again'
                break
              case 'deleted':
                channelErrMsg = 'Feed missing from database'
                break
              case 'feed':
                channelErrMsg = 'No articles that pass current filters'
                break
              default:
                channelErrMsg = 'No reason available'
            }
            log.command.warning(`Unable to send filtered test article '${err.feed.link}':`, message.guild, err)
            return message.channel.send(`Unable to grab feed article for feed <${err.feed.link}> (${channelErrMsg}).`).catch(err => log.command.warning(`Unable to grab feed article for ${err.feed.link} for rssfilters`, message.guild, err))
          }
          log.command.info(`Sending filtered article for ${source.link}`, message.guild)
          article.rssName = rssName
          article.discordChannelId = message.channel.id
          new ArticleMessage(article, true, true).send(err => {
            if (!err) return
            if (err.code === 50035) message.channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``)
            else message.channel.send(`Failed to send formatted article <${article.link}> \`\`\`${err.message}\`\`\``)
          })
        })
      }
    } catch (err) {
      log.command.warning(`rssfilters`, message.guild, err)
    }
  })
}

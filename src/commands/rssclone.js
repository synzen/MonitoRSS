const config = require('../config.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const properties = [`message`, `embed`, `filters`, `misc-options`, `subscriptions`, 'all']

async function destSelectorFn (m, data) {
  const { guildRss, rssName, rssNameList } = data
  const sourceFeedLink = guildRss.sources[rssName].link
  const destFeedLinks = []
  for (let i = 0; i < rssNameList.length; ++i) {
    destFeedLinks.push(guildRss.sources[rssNameList[i]].link)
  }
  const cloned = []
  if (data.cloneMessage) cloned.push('message')
  if (data.cloneEmbed) cloned.push('embed')
  if (data.cloneFilters) cloned.push('filters')
  if (data.cloneMiscOptions) cloned.push('misc-options')
  if (data.cloneSubscriptions) cloned.push('subscriptions')

  return {
    ...data,
    clonedProps: cloned,
    next: {
      text: Translator.translate('commands.rssclone.confirm', guildRss.locale, { link: sourceFeedLink, cloning: cloned.join('`, `'), destinations: destFeedLinks.join('\n') })
    }
  }
}

async function confirmFn (m, data) {
  if (m.content !== 'yes') {
    throw new MenuUtils.MenuOptionError(Translator.translate('commands.rssclone.confirmError', data.guildRss ? data.guildRss.locale : null))
  }
  return { ...data, confirmed: true }
}

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const guildLocale = guildRss ? guildRss.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const sourceSelector = new FeedSelector(message, undefined, { command: command, prependDescription: translate('commands.rssclone.copyFrom'), globalSelect: true }, guildRss)
    const destSelector = new FeedSelector(message, destSelectorFn, { command: command, prependDescription: translate('commands.rssclone.copyTo'), multiSelect: true, globalSelect: true }, guildRss)
    const confirm = new MenuUtils.Menu(message, confirmFn, { splitOptions: { prepend: '```', append: '```' } })
    const prefix = guildRss.prefix || config.bot.prefix
    const args = MenuUtils.extractArgsAfterCommand(message.content)
    if (args.length === 0) {
      return await message.channel.send(translate('commands.rssclone.noProperties', { prefix, properties: properties.join('`, `') }))
    }
    let invalidArgs = []
    for (const arg of args) {
      if (!properties.includes(arg)) {
        invalidArgs.push(arg)
      }
    }
    if (invalidArgs.length > 0) {
      return await message.channel.send(translate('commands.rssclone.invalidProperties', { invalid: invalidArgs.join('`, `'), properties: properties.join('`, `') }))
    }

    const cloneAll = args.includes('all')
    const cloneMessage = cloneAll || args.includes('message')
    const cloneEmbed = cloneAll || args.includes('embed')
    const cloneFilters = cloneAll || args.includes('filters')
    const cloneMiscOptions = cloneAll || args.includes('misc-options')
    const cloneSubscriptions = cloneAll || args.includes('subscriptions')

    const data = await new MenuUtils.MenuSeries(message, [sourceSelector, destSelector, confirm], { cloneMessage, cloneEmbed, cloneFilters, cloneMiscOptions, cloneSubscriptions, locale: guildLocale }).start()
    if (!data || !data.confirmed) return

    const sourceFeed = guildRss.sources[data.rssName]
    const destFeeds = []
    for (let i = 0; i < data.rssNameList.length; ++i) {
      destFeeds.push(guildRss.sources[data.rssNameList[i]])
    }
    // If any of these props are empty in the source feed, then it will simply be deleted
    const emptyMessage = !sourceFeed.message
    const emptyEmbed = !sourceFeed.embeds || sourceFeed.embeds.length === 0
    const emptyFilters = !sourceFeed.filters || Object.keys(sourceFeed.filters).length === 0
    const emptySubscriptions = !sourceFeed.subscribers || sourceFeed.subscribers.length === 0
    let destLinksCount = 0

    destFeeds.forEach(destFeed => {
      // Message
      if (emptyMessage) delete destFeed.message
      else if (cloneMessage) destFeed.message = sourceFeed.message

      // Embed
      if (emptyEmbed) delete destFeed.embeds
      else if (cloneEmbed) destFeed.embeds = JSON.parse(JSON.stringify(sourceFeed.embeds))

      // Filters
      if (emptyFilters) {
        const origFilteredRoleSubs = destFeed.filters && destFeed.filters.roleSubscriptions ? JSON.parse(JSON.stringify(destFeed.filters.roleSubscriptions)) : undefined
        if (origFilteredRoleSubs) destFeed.filters = { roleSubscriptions: origFilteredRoleSubs }
        else delete destFeed.filters
      } else if (cloneFilters) {
        const origFilteredRoleSubs = destFeed.filters && destFeed.filters.roleSubscriptions ? JSON.parse(JSON.stringify(destFeed.filters.roleSubscriptions)) : undefined
        const copy = JSON.parse(JSON.stringify(sourceFeed.filters))
        delete copy.roleSubscriptions
        destFeed.filters = copy
        if (origFilteredRoleSubs) destFeed.filters.roleSubscriptions = origFilteredRoleSubs
      }

      // Options
      if (cloneMiscOptions) {
        destFeed.checkTitles = sourceFeed.checkTitles
        destFeed.imgPreviews = sourceFeed.imgPreviews
        destFeed.imgLinksExistence = sourceFeed.imgLinksExistence
        destFeed.checkDates = sourceFeed.checkDates
        destFeed.formatTables = sourceFeed.formatTables
        if (sourceFeed.splitMessage) destFeed.splitMessage = JSON.parse(JSON.stringify(sourceFeed.splitMessage))
      }

      // Global Roles
      if (emptySubscriptions) delete destFeed.subscribers
      else if (cloneSubscriptions) destFeed.subscribers = JSON.parse(JSON.stringify(sourceFeed.subscribers))

      destLinksCount++
    })

    log.command.info(`Properties ${data.clonedProps.join(',')} for the feed ${sourceFeed.link} cloning to to ${destLinksCount} feeds`, message.guild)
    await dbOpsGuilds.update(guildRss)
    await message.channel.send(`${translate('commands.rssclone.success', { cloned: data.clonedProps.join('`, `'), link: sourceFeed.link, destinationCount: destLinksCount })} ${translate('generics.backupReminder', { prefix })}`)
  } catch (err) {
    log.command.warning(`rssclone`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssclone 1', message.guild, err))
  }
}

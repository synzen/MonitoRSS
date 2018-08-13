const config = require('../config.json')
const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
function destSelectorFn (m, data, callback) {
  const { guildRss, rssName, rssNameList } = data
  const sourceFeedLink = guildRss.sources[rssName].link
  const destFeedLinks = []
  for (var i = 0; i < rssNameList.length; ++i) destFeedLinks.push(guildRss.sources[rssNameList[i]].link)
  const cloned = []
  if (data.cloneMessage) cloned.push('message')
  if (data.cloneEmbed) cloned.push('embed')
  if (data.cloneFilters) cloned.push('filters')
  if (data.cloneMiscOptions) cloned.push('misc-options')
  if (data.cloneGlobalRoles) cloned.push('global-roles')
  if (data.cloneFilteredRoles) cloned.push('filtered-roles')

  callback(null, {
    ...data,
    clonedProps: cloned,
    next: {
      text: `The following settings for the feed <${sourceFeedLink}>\n\n\`${cloned.join('`, `')}\`\n\nare about to be cloned into the following feeds:\n\`\`\`${destFeedLinks.join('\n')}\`\`\`\nNote that if a property does not exist in the source feed, the same property in the destination feed(s) will be **deleted**.To confirm this, type \`yes\`. Otherwise, type \`exit\` to cancel.`
    }
  })
}

function askConfirm (m, data, callback) {
  if (m.content !== 'yes') return callback(new SyntaxError('You must confirm by typing `yes`, or cancel by typing `exit`. Try again.'))
  callback(null, { ...data, confirmed: true })
}

module.exports = (bot, message, command) => {
  const sourceSelector = new FeedSelector(message, undefined, { command: command, prependDescription: 'Select the source to copy from.', globalSelect: true })
  const destSelector = new FeedSelector(message, destSelectorFn, { command: command, prependDescription: 'Select the destination(s) to copy to.', multiSelect: true, globalSelect: true })
  const confirm = new MenuUtils.Menu(message, askConfirm, { splitOptions: { prepend: '```', append: '```' } })

  let args = message.content.split(' ')
  args.shift()
  args = MenuUtils.trimArray(args)

  if (args.length === 0) return message.channel.send(`You must add at least one property to clone as an argument. The properties available for cloning are \`message\`, \`embed\`, \`filters\`, \`misc-options\`, \`global-roles\` and \`filtered-roles\`. To clone all these properties, you can just use \`all\`.\n\nFor example, to clone a feed's message and embed, type \`${config.bot.prefix}rssclone message embed\`.`)

  const cloneAll = args.includes('all')
  const cloneMessage = cloneAll || args.includes('message')
  const cloneEmbed = cloneAll || args.includes('embed')
  const cloneFilters = cloneAll || args.includes('filters')
  const cloneMiscOptions = cloneAll || args.includes('misc-options')
  const cloneGlobalRoles = cloneAll || args.includes('global-roles')
  const cloneFilteredRoles = cloneAll || args.includes('filtered-roles')

  new MenuUtils.MenuSeries(message, [sourceSelector, destSelector, confirm], { cloneMessage, cloneEmbed, cloneFilters, cloneMiscOptions, cloneGlobalRoles, cloneFilteredRoles }).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message ? err.message : 'hee')
      if (!data.confirmed) return
      const m = await message.channel.send('Cloning...')

      const sourceFeed = data.guildRss.sources[data.rssName]
      const destFeeds = []
      for (var i = 0; i < data.rssNameList.length; ++i) destFeeds.push(data.guildRss.sources[data.rssNameList[i]])
      // If any of these props are empty in the source feed, then it will simply be deleted
      const emptyMessage = !sourceFeed.message
      const emptyEmbed = !sourceFeed.embeds || sourceFeed.embeds.length === 0
      const emptyFilters = !sourceFeed.filters || Object.keys(sourceFeed.filters).length === 0
      const emptyGlobalRoles = !sourceFeed.roleSubscriptions || sourceFeed.roleSubscriptions.length === 0
      const emptyFilteredRoles = emptyFilters || !sourceFeed.filters.roleSubscriptions || Object.keys(sourceFeed.filters.roleSubscriptions).length === 0
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
        if (emptyGlobalRoles) delete destFeed.roleSubscriptions
        else if (cloneGlobalRoles) destFeed.roleSubscriptions = JSON.parse(JSON.stringify(sourceFeed.roleSubscriptions))

        // Filtered Roles
        if (emptyFilteredRoles && destFeed.filters) delete destFeed.filters.roleSubscriptions
        else if (cloneFilteredRoles && !emptyFilteredRoles) {
          if (!destFeed.filters) destFeed.filters = {}
          destFeed.filters.roleSubscriptions = JSON.parse(JSON.stringify(sourceFeed.filters.roleSubscriptions))
        }

        destLinksCount++
      })

      dbOps.guildRss.update(data.guildRss)

      log.command.info(`Properties ${data.clonedProps.join(',')} for the feed ${sourceFeed.link} have been cloned to ${destLinksCount} feeds`)
      await m.edit(`The following settings\n\n\`${data.clonedProps.join('`, `')}\`\n\nfor the feed <${sourceFeed.link}> have been successfully cloned into ${destLinksCount} feed(s). After completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`)
    } catch (err) {
      log.command.warning(`rssclone`, message.guild, err, true)
    }
  })
}

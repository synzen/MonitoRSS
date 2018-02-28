const config = require('../config.json')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const currentGuilds = storage.currentGuilds
const overrides = storage.limitOverrides
const MenuUtils = require('./util/MenuUtils.js')
const FAIL_LIMIT = config.feedSettings.failLimit

function feedStatus (failedLinks, link) {
  const failCount = failedLinks[link]
  return !failCount || (typeof failCount === 'number' && failCount <= FAIL_LIMIT) ? `Status: OK ${failCount > Math.ceil(FAIL_LIMIT / 5) ? '(' + failCount + '/' + FAIL_LIMIT + ')' : ''}\n` : 'Status: FAILED\n'
}

module.exports = (bot, message, command) => {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) return message.channel.send('There are no existing feeds.').catch(err => log.command.warning(`chooseFeed 2`, message.guild, err))

  const failedLinks = storage.failedLinks
  const rssList = guildRss.sources
  let failedFeedCount = 0

  const maxFeedsAllowed = overrides[message.guild.id] != null ? overrides[message.guild.id] === 0 ? 'Unlimited' : overrides[message.guild.id] : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 'Unlimited' : config.feedSettings.maxFeeds

  // Generate the info for each feed as an array, and push into another array
  const currentRSSList = []
  for (var rssName in rssList) {
    const feed = rssList[rssName]
    let o = {
      link: feed.link,
      title: feed.title,
      webhook: feed.webhook ? feed.webhook.id : undefined,
      channel: bot.channels.get(feed.channel) ? bot.channels.get(feed.channel).name : undefined,
      titleChecks: feed.titleChecks === true ? 'Title Checks: Enabled\n' : null
    }
    if (FAIL_LIMIT !== 0) o.status = feedStatus(failedLinks, feed.link)
    if (o.status.startsWith('STATUS: FAILED')) ++failedFeedCount
    currentRSSList.push(o)
  }

  let desc = `**Server Limit:** ${Object.keys(rssList).length}/${maxFeedsAllowed}\u200b\n\u200b\n`
  desc += failedFeedCount > 0 ? `**Attention!** Feeds that have reached ${FAIL_LIMIT} connection failure limit have been detected. They will no longer be retried until the bot instance is restarted. Please either remove, or use *${config.botSettings.prefix}rssrefresh* to try to reset its status.\u200b\n\u200b\n` : ''

  const list = new MenuUtils.Menu(message)
    .setAuthor('Current Active Feeds')
    .setDescription(desc)

  currentRSSList.forEach(item => {
    const link = item.link
    const title = item.title
    const channelName = item.channel
    const status = item.status
    const titleChecks = item.titleChecks
    const webhook = item.webhook

    list.addOption(`${title.length > 200 ? title.slice(0, 200) + '[...]' : title}`, `${titleChecks || ''}${status || ''}Channel: #${channelName}\n${webhook ? 'Webhook: ' + webhook + '\n' : ''}Link: ${link.length > 500 ? '*Exceeds 500 characters*' : link}`)
  })

  list.send(null, async err => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
    } catch (err) {
      log.command.warning(`rsslist`, message.guild, err)
    }
  })
}

const config = require('../config.json')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const currentGuilds = storage.currentGuilds
const MenuUtils = require('../structs/MenuUtils.js')
const moment = require('moment')
const FAIL_LIMIT = config.feeds.failLimit

module.exports = (bot, message, command) => {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) return message.channel.send('There are no existing feeds.').catch(err => log.command.warning(`chooseFeed 2`, message.guild, err))

  const failedLinks = storage.failedLinks
  const rssList = guildRss.sources
  let failedFeedCount = 0

  const maxFeedsAllowed = storage.vipServers[message.guild.id] && storage.vipServers[message.guild.id].benefactor.maxFeeds ? storage.vipServers[message.guild.id].benefactor.maxFeeds : !config.feeds.max || isNaN(parseInt(config.feeds.max)) ? 0 : config.feeds.max
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
    if (FAIL_LIMIT !== 0) {
      const failCount = failedLinks[feed.link]
      o.status = !failCount || (typeof failCount === 'number' && failCount <= FAIL_LIMIT) ? `Status: OK ${failCount > Math.ceil(FAIL_LIMIT / 5) ? '(failed ' + failCount + '/' + FAIL_LIMIT + ' times)' : ''}\n` : 'Status: FAILED\n'
      if (o.status.startsWith('Status: FAILED')) ++failedFeedCount
    }
    if (rssList[rssName].disabled === true) o.status = `Status: DISABLED\n`
    currentRSSList.push(o)
  }

  let vipDetails = ''
  if (storage.vipServers[message.guild.id]) {
    vipDetails += '**Patron Until:** '
    const vipLen = storage.vipServers[message.guild.id]
    if (vipLen.expireAt) {
      const expireAt = moment(vipLen.expireAt)
      const daysLeft = Math.round(moment.duration(expireAt.diff(moment())).asDays())
      vipDetails += `${expireAt.format('D MMMM YYYY')} (${daysLeft} days)\n`
    } else vipDetails += 'Ongoing\n'
  } else vipDetails = '\n'

  let desc = maxFeedsAllowed === 0 ? `${vipDetails}\u200b\n` : `${vipDetails}**Server Limit:** ${Object.keys(rssList).length}/${maxFeedsAllowed} [＋](https://www.patreon.com/discordrss)\n\u200b\n`
  desc += failedFeedCount > 0 ? `**Attention!** Feeds that have reached ${FAIL_LIMIT} connection failure limit have been detected. They will no longer be retried until the bot instance is restarted. Please either remove, or use *${config.bot.prefix}rssrefresh* to try to reset its status.\u200b\n\u200b\n` : ''

  const list = new MenuUtils.Menu(message)
    .setAuthor('Current Active Feeds')
    .setDescription(desc)

  if (storage.vipServers[message.guild.id] && storage.vipServers[message.guild.id].benefactor) {
    const benefactor = storage.vipServers[message.guild.id].benefactor
    list.setFooter(`Patronage backed by ${benefactor.name} (${benefactor.id})`)
  }

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

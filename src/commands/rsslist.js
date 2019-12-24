const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const moment = require('moment')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const dbOpsSchedules = require('../util/db/schedules.js')
const serverLimit = require('../util/serverLimit.js')
const storage = require('../util/storage.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const FAIL_LIMIT = config.feeds.failLimit

module.exports = async (bot, message, command) => {
  try {
    const [ profile, serverLimitData ] = await Promise.all([ GuildProfile.get(message.guild.id), serverLimit(message.guild.id) ])
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
    if (!profile || profile.feeds.length === 0) {
      return await message.channel.send(translate('commands.rsslist.noFeeds'))
    }

    const failedLinks = {}
    // const rssList = guildRss.sources
    const feeds = await profile.getFeeds()
    let failedFeedCount = 0

    const vipUser = serverLimitData.vipUser
    const maxFeedsAllowed = serverLimitData.max

    // Generate the info for each feed as an array, and push into another array
    const currentRSSList = []
    const failedLinksToCheck = []
    const schedulesToFetch = []
    const schedulesByFeedIDs = {}
    for (const feed of feeds) {
      schedulesToFetch.push(dbOpsSchedules.assignedSchedules.get(feed.id))
      let o = {
        id: feed.id,
        url: feed.url,
        title: feed.title,
        webhook: feed.webhook ? feed.webhook.id : undefined,
        channel: bot.channels.get(feed.channel) ? bot.channels.get(feed.channel).name : undefined,
        checkTitles: feed.checkTitles === true ? translate('commands.rsslist.titleChecksEnabled') : null
      }
      failedLinksToCheck.push(feed.url)
      if (feed.disabled) {
        o.status = translate('commands.rsslist.statusDisabled', { reason: feed.disabled })
        o.isDisabled = true
      }
      currentRSSList.push(o)
    }
    const [ failedLinksResults, assignedSchedules ] = await Promise.all([ dbOpsFailedLinks.getMultiple(failedLinksToCheck), Promise.all(schedulesToFetch) ])
    for (const result of failedLinksResults) {
      failedLinks[result.link] = result.failed || result.count
    }
    for (const assigned of assignedSchedules) {
      schedulesByFeedIDs[assigned.feedID] = assigned
    }
    if (FAIL_LIMIT !== 0) {
      for (const feed of currentRSSList) {
        if (feed.isDisabled) continue
        const failCount = failedLinks[feed.link]
        const failCountText = failCount > Math.ceil(FAIL_LIMIT / 5) ? `(failed ${failCount}/${FAIL_LIMIT} times` : ''
        feed.status = !failCount || (typeof failCount === 'number' && failCount <= FAIL_LIMIT) ? translate('commands.rsslist.statusOk', { failCount: failCountText }) : translate('commands.rsslist.statusFailed')
        if (feed.status.startsWith('Status: FAILED')) {
          ++failedFeedCount
        }
      }
    }

    let vipDetails = ''
    if (vipUser) {
      vipDetails += '**Patron Until:** '
      if (vipUser.expireAt) {
        const expireAt = moment(vipUser.expireAt)
        const daysLeft = Math.round(moment.duration(expireAt.diff(moment())).asDays())
        vipDetails += `${expireAt.format('D MMMM YYYY')} (${daysLeft} days)\n`
      } else vipDetails += 'Ongoing\n'
    } else vipDetails = '\n'

    let desc = maxFeedsAllowed === 0 ? `${vipDetails}\u200b\n` : `${vipDetails}**${translate('commands.rsslist.serverLimit')}:** ${profile.feeds.length}/${maxFeedsAllowed} [＋](https://www.patreon.com/discordrss)\n\n\u200b`
    desc += failedFeedCount > 0 ? translate('commands.rsslist.failAlert', { failLimit: FAIL_LIMIT, prefix: profile.prefix || config.bot.prefix }) : ''

    const list = new MenuUtils.Menu(message)
      .setAuthor(translate('commands.rsslist.currentActiveFeeds'))
      .setDescription(desc)

    if (vipUser) list.setFooter(`Patronage backed by ${vipUser.name} (${vipUser.id})`)

    currentRSSList.forEach(item => {
      const url = item.url
      const title = item.title
      const channelName = item.channel
      const status = item.status
      const titleChecks = item.titleChecks
      const webhook = item.webhook
      const schedule = storage.scheduleManager.getSchedule(schedulesByFeedIDs[item.id].schedule)
      let refreshRate = schedule ? schedule.refreshRate < 1 ? `${schedule.refreshRate * 60} ${translate('commands.rsslist.seconds')}` : `${schedule.refreshRate} ${translate('commands.rsslist.minutes')}` : translate('commands.rsslist.unknown')
      if (config._vip === true && !vipUser) refreshRate += ' [－](https://www.patreon.com/discordrss)'
      list.addOption(`${title.length > 200 ? title.slice(0, 200) + '[...]' : title}`, `${titleChecks || ''}${status || ''}${translate('generics.channelUpper')}: #${channelName}\n${translate('commands.rsslist.refreshRate')}: ${refreshRate}\n${webhook ? `${translate('commands.rsslist.webhook')}: ${webhook}\n` : ''}${translate('commands.rsslist.link')}: ${url.length > 500 ? translate('commands.rsslist.exceeds500Characters') : url}`)
    })

    await list.send()
  } catch (err) {
    log.command.warning(`rsslist`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsslist 1', message.guild, err))
  }
}

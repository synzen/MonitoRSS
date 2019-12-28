const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const moment = require('moment')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const serverLimit = require('../util/serverLimit.js')
const storage = require('../util/storage.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const AssignedSchedule = require('../structs/db/AssignedSchedule.js')
const FAIL_LIMIT = config.feeds.failLimit

module.exports = async (bot, message, command) => {
  try {
    const [ profile, serverLimitData ] = await Promise.all([ GuildProfile.get(message.guild.id), serverLimit(message.guild.id) ])
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
    const feeds = profile ? await profile.getFeeds() : []
    if (feeds.length === 0) {
      return await message.channel.send(translate('commands.rsslist.noFeeds'))
    }

    const failedLinks = {}
    const vipUser = serverLimitData.vipUser
    const maxFeedsAllowed = serverLimitData.max

    // Generate the info for each feed as an array, and push into another array
    const failedLinksToCheck = feeds.map(feed => feed.url)
    const shard = message.client.shard && message.client.shard.count > 0 ? message.client.shard.id : undefined
    const schedulesToFetch = feeds.map(feed => AssignedSchedule.getByFeedAndShard(feed._id, shard))
    const schedulesByFeedIDs = {}

    const [ failedLinksResults, assignedSchedules ] = await Promise.all([
      dbOpsFailedLinks.getMultiple(failedLinksToCheck),
      Promise.all(schedulesToFetch)
    ])
    for (const result of failedLinksResults) {
      failedLinks[result.link] = result.failed || result.count
    }
    for (const assigned of assignedSchedules) {
      schedulesByFeedIDs[assigned.feed] = assigned
    }

    let vipDetails = ''
    if (vipUser) {
      vipDetails += '**Patron Until:** '
      if (vipUser.expireAt) {
        const expireAt = moment(vipUser.expireAt)
        const daysLeft = Math.round(moment.duration(expireAt.diff(moment())).asDays())
        vipDetails += `${expireAt.format('D MMMM YYYY')} (${daysLeft} days)\n`
      } else {
        vipDetails += 'Ongoing\n'
      }
    } else {
      vipDetails = '\n'
    }

    let desc = maxFeedsAllowed === 0 ? `${vipDetails}\u200b\n` : `${vipDetails}**${translate('commands.rsslist.serverLimit')}:** ${feeds.length}/${maxFeedsAllowed} [＋](https://www.patreon.com/discordrss)\n\n\u200b`
    // desc += failedFeedCount > 0 ? translate('commands.rsslist.failAlert', { failLimit: FAIL_LIMIT, prefix: profile.prefix || config.bot.prefix }) : ''

    const list = new MenuUtils.Menu(message)
      .setAuthor(translate('commands.rsslist.currentActiveFeeds'))
      .setDescription(desc)

    if (vipUser) {
      list.setFooter(`Patronage backed by ${vipUser.name} (${vipUser.id})`)
    }

    feeds.forEach(feed => {
      // URL
      const url = feed.url.length > 500 ? translate('commands.rsslist.exceeds500Characters') : feed.url

      // Title
      const title = feed.title

      // Channel
      const channelName = bot.channels.get(feed.channel) ? bot.channels.get(feed.channel).name : 'Unknown'

      // Status
      let status = ''
      if (feed.disabled) {
        status = translate('commands.rsslist.statusDisabled', { reason: feed.disabled })
      } else if (FAIL_LIMIT !== 0) {
        const failCount = failedLinks[feed.url]
        const failCountText = failCount > Math.ceil(FAIL_LIMIT / 5) ? `(failed ${failCount}/${FAIL_LIMIT} times` : ''
        status = !failCount || (typeof failCount === 'number' && failCount <= FAIL_LIMIT) ? translate('commands.rsslist.statusOk', { failCount: failCountText }) : translate('commands.rsslist.statusFailed')
      }

      // Title checks
      const titleChecks = feed.checkTitles === true ? translate('commands.rsslist.titleChecksEnabled') : ''

      // Webhook
      const webhook = feed.webhook ? `${translate('commands.rsslist.webhook')}: ${feed.webhook.id}\n` : ''

      // Refresh rate
      const schedule = storage.scheduleManager.getSchedule(schedulesByFeedIDs[feed._id].schedule)
      let refreshRate = schedule ? schedule.refreshRate < 1 ? `${schedule.refreshRate * 60} ${translate('commands.rsslist.seconds')}` : `${schedule.refreshRate} ${translate('commands.rsslist.minutes')}` : translate('commands.rsslist.unknown')

      // Patreon link
      if (config._vip === true && !vipUser) {
        refreshRate += ' [－](https://www.patreon.com/discordrss)'
      }
      list.addOption(`${title.length > 200 ? title.slice(0, 200) + '[...]' : title}`, `${titleChecks}${status}${translate('generics.channelUpper')}: #${channelName}\n${translate('commands.rsslist.refreshRate')}: ${refreshRate}\n${webhook}${translate('commands.rsslist.link')}: ${url}`)
    })

    await list.send()
  } catch (err) {
    log.command.warning(`rsslist`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsslist 1', message.guild, err))
  }
}

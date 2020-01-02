const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const moment = require('moment')
const storage = require('../util/storage.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const AssignedSchedule = require('../structs/db/AssignedSchedule.js')
const FailCounter = require('../structs/db/FailCounter.js')
const Supporter = require('../structs/db/Supporter.js')
const Feed = require('../structs/db/Feed.js')

module.exports = async (bot, message, command) => {
  try {
    const [ profile, supporter ] = await Promise.all([
      GuildProfile.get(message.guild.id),
      Supporter.getValidSupporterOfGuild(message.guild.id)
    ])
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    if (feeds.length === 0) {
      return await message.channel.send(translate('commands.rsslist.noFeeds'))
    }

    const failedLinks = {}
    const maxFeedsAllowed = supporter ? await supporter.getMaxFeeds() : config.feeds.max

    // Generate the info for each feed as an array, and push into another array
    const failCounters = await Promise.all(feeds.map(feed => FailCounter.getBy('url', feed.url)))
    const shard = message.client.shard && message.client.shard.count > 0 ? message.client.shard.id : -1
    const schedulesToFetch = feeds.map(feed => AssignedSchedule.getByFeedAndShard(feed._id, shard))
    const schedulesByFeedIDs = {}

    const assignedSchedules = await Promise.all(schedulesToFetch)

    for (const counter of failCounters) {
      if (counter) {
        failedLinks[counter.url] = counter
      }
    }
    for (const assigned of assignedSchedules) {
      schedulesByFeedIDs[assigned.feed] = assigned
    }

    let vipDetails = ''
    if (supporter) {
      vipDetails += '**Patron Until:** '
      if (supporter.expireAt) {
        const expireAt = moment(supporter.expireAt)
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

    if (supporter) {
      list.setFooter(`Patronage backed by ${supporter._id}`)
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
      } else if (FailCounter.limit !== 0) {
        const failCounter = failedLinks[feed.url]
        const count = !failCounter ? 0 : failCounter.count
        if (!failCounter || !failCounter.hasFailed()) {
          const failCountText = count > Math.ceil(FailCounter.limit / 5) ? `(failed ${count}/${FailCounter.limit} times` : ''
          status = translate('commands.rsslist.statusOk', { failCount: failCountText })
        } else {
          status = translate('commands.rsslist.statusFailed')
        }
      }

      // Title checks
      const titleChecks = feed.checkTitles === true ? translate('commands.rsslist.titleChecksEnabled') : ''

      // Webhook
      const webhook = feed.webhook ? `${translate('commands.rsslist.webhook')}: ${feed.webhook.id}\n` : ''

      // Refresh rate
      const schedule = storage.scheduleManager.getSchedule(schedulesByFeedIDs[feed._id].schedule)
      let refreshRate = schedule ? schedule.refreshRate < 1 ? `${schedule.refreshRate * 60} ${translate('commands.rsslist.seconds')}` : `${schedule.refreshRate} ${translate('commands.rsslist.minutes')}` : translate('commands.rsslist.unknown')

      // Patreon link
      if (Supporter.compatible === true && !supporter) {
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

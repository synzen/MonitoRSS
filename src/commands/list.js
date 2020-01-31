const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const moment = require('moment')
const Schedule = require('../structs/db/Schedule.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailRecord = require('../structs/db/FailRecord.js')
const Supporter = require('../structs/db/Supporter.js')
const Feed = require('../structs/db/Feed.js')

module.exports = async (bot, message, command) => {
  try {
    const [ profile, supporter, schedules, supporterGuilds ] = await Promise.all([
      Profile.get(message.guild.id),
      Supporter.getValidSupporterOfGuild(message.guild.id),
      Schedule.getAll(),
      Supporter.getValidGuilds()
    ])
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    if (feeds.length === 0) {
      return await message.channel.send(translate('commands.list.noFeeds'))
    }

    const failRecordsMap = {}
    const maxFeedsAllowed = supporter ? await supporter.getMaxFeeds() : config.feeds.max

    // Generate the info for each feed as an array, and push into another array
    const failRecords = await Promise.all(feeds.map(feed => FailRecord.getBy('url', feed.url)))
    const fetchedSchedules = await Promise.all(feeds.map(feed => feed.determineSchedule(schedules, supporterGuilds)))

    for (const record of failRecords) {
      if (record) {
        failRecordsMap[record.url] = record
      }
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

    let desc = maxFeedsAllowed === 0 ? `${vipDetails}\u200b\n` : `${vipDetails}**${translate('commands.list.serverLimit')}:** ${feeds.length}/${maxFeedsAllowed} [＋](https://www.patreon.com/discordrss)\n\n\u200b`
    // desc += failedFeedCount > 0 ? translate('commands.list.failAlert', { failLimit: FAIL_LIMIT, prefix: profile && profile.prefix ? profile.prefix : config.bot.prefix }) : ''

    const list = new MenuUtils.Menu(message)
      .setAuthor(translate('commands.list.currentActiveFeeds'))
      .setDescription(desc)

    if (supporter) {
      list.setFooter(`Patronage backed by ${supporter._id}`)
    }

    feeds.forEach((feed, i) => {
      // URL
      const url = feed.url.length > 500 ? translate('commands.list.exceeds500Characters') : feed.url

      // Title
      const title = feed.title

      // Channel
      const channelName = bot.channels.get(feed.channel) ? bot.channels.get(feed.channel).name : 'Unknown'

      // Status
      let status = ''
      if (feed.disabled) {
        status = translate('commands.list.statusDisabled', { reason: feed.disabled })
      } else if (FailRecord.limit !== 0) {
        const failRecord = failRecordsMap[feed.url]
        if (!failRecord || !failRecord.hasFailed()) {
          let health = '100%'
          if (failRecord) {
            // Determine hours between config spec and now, then calculate health
            const hours = (new Date().getTime() - new Date(failRecord.failedAt).getTime()) / 36e5
            health = `(${100 - Math.ceil(hours / config.feeds.hoursUntilFail * 100)}% health)`
          }
          status = translate('commands.list.statusOk', { failCount: `${health}` })
        } else {
          status = translate('commands.list.statusFailed')
        }
      }

      // Title checks
      const titleChecks = feed.checkTitles === true ? translate('commands.list.titleChecksEnabled') : ''

      // Webhook
      const webhook = feed.webhook ? `${translate('commands.list.webhook')}: ${feed.webhook.id}\n` : ''

      // Refresh rate
      const schedule = fetchedSchedules[i]
      let refreshRate = schedule.refreshRateMinutes < 1 ? `${schedule.refreshRateMinutes * 60} ${translate('commands.list.seconds')}` : `${schedule.refreshRateMinutes} ${translate('commands.list.minutes')}`
      // : translate('commands.list.unknown')

      // Patreon link
      if (Supporter.enabled && !supporter) {
        refreshRate += ' [－](https://www.patreon.com/discordrss)'
      }
      list.addOption(`${title.length > 200 ? title.slice(0, 200) + '[...]' : title}`, `${titleChecks}${status}${translate('generics.channelUpper')}: #${channelName}\n${translate('commands.list.refreshRate')}: ${refreshRate}\n${webhook}${translate('commands.list.link')}: ${url}`)
    })

    await list.send()
  } catch (err) {
    log.command.warning(`rsslist`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsslist 1', message.guild, err))
  }
}

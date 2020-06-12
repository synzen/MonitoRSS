const moment = require('moment-timezone')
const Supporter = require('../../../structs/db/Supporter.js')
const Schedule = require('../../../structs/db/Schedule.js')
const FailRecord = require('../../../structs/db/FailRecord.js')
const { MenuEmbed, MenuVisual, MessageVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed.js')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const handlePaginationError = require('../common/utils/handlePaginationError.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('discord.js').TextChannel} [channel]
 * @property {string} [searchQuery]
 * @property {string} guildID
 */

/**
 * @param {import('../../../structs/db/Feed.js')[]} feeds
 * @param {string} query
 */
function queryFeeds (feeds, query) {
  if (!query) {
    return feeds
  }
  return feeds.filter(feed => {
    for (const key in feed) {
      const value = feed[key]
      if (typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())) {
        return true
      }
    }
  })
}

/**
 * @param {Data} data
 */
async function listFeedVisual (data) {
  const { feeds, profile, guildID, channel, searchQuery } = data
  const [supporter, schedules, supporterGuilds] = await Promise.all([
    Supporter.getValidSupporterOfGuild(guildID),
    Schedule.getAll(),
    Supporter.getValidGuilds()
  ])

  const unqueriedFeeds = channel ? feeds.filter(f => f.channel === channel.id) : feeds
  const targetFeeds = queryFeeds(unqueriedFeeds, searchQuery)
  const translate = Translator.createProfileTranslator(profile)
  if (feeds.length === 0) {
    return new MessageVisual(translate('commands.list.noFeeds'))
  } else if (targetFeeds.length === 0) {
    return new MessageVisual(translate('commands.list.noFeedsChannel', {
      channel: `<#${channel.id}>`
    }))
  }

  const config = getConfig()
  const failRecordsMap = {}
  const maxFeedsAllowed = supporter ? await supporter.getMaxFeeds() : config.feeds.max

  // Generate the info for each feed as an array, and push into another array
  const failRecords = await Promise.all(targetFeeds.map(feed => FailRecord.get(feed.url)))
  const fetchedSchedules = await Promise.all(targetFeeds.map(feed => feed.determineSchedule(schedules, supporterGuilds)))

  for (const record of failRecords) {
    if (record) {
      failRecordsMap[record._id] = record
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

  const desc = maxFeedsAllowed === 0
    ? `${vipDetails}\u200b\n`
    : `${vipDetails}**${translate('commands.list.serverLimit')}:** ${targetFeeds.length}/${maxFeedsAllowed} [＋](https://www.patreon.com/discordrss)\n\n\u200b`

  const list = new ThemedEmbed()
    .setDescription(desc)

  const countString = targetFeeds.length === feeds.length ? targetFeeds.length : `${targetFeeds.length}/${feeds.length} total`

  if (!channel) {
    list.setAuthor(translate('commands.list.feedList') + ` (${countString})`)
  } else {
    list.setAuthor(translate('commands.list.feedListChannel', {
      channel: channel.name
    }) + ` (${countString})`)
  }

  if (supporter) {
    list.setFooter(`Patronage backed by ${supporter._id}`)
  }

  const menu = new MenuEmbed(list)
    .enablePagination(handlePaginationError)

  let someFailed = false
  targetFeeds.forEach((feed, index) => {
    // URL
    const url = feed.url.length > 500 ? translate('commands.list.exceeds500Characters') : feed.url

    // Title
    const title = feed.title

    // Channel
    const channel = `<#${feed.channel}>`

    // Status
    const failRecord = failRecordsMap[feed.url]
    let status = ''
    if (feed.disabled) {
      status = translate('commands.list.statusDisabled', { reason: feed.disabled })
    } else if (failRecord) {
      if (!failRecord.hasFailed()) {
        // Determine hours between config spec and now, then calculate health
        const hours = (new Date().getTime() - new Date(failRecord.failedAt).getTime()) / 36e5
        const health = FailRecord.cutoff === 0 ? '(100% health)' : `(${100 - Math.ceil(hours / FailRecord.cutoff * 100)}% health)`
        status = translate('commands.list.statusOk', { failCount: health })
      } else {
        status = translate('commands.list.statusFailed')
        someFailed = true
      }
    } else {
      status = translate('commands.list.statusOk', { failCount: '(100% health)' })
    }

    // Title checks
    const titleChecks = feed.checkTitles === true
      ? translate('commands.list.titleChecksEnabled')
      : ''

    // Webhook
    const webhook = feed.webhook
      ? `${translate('commands.list.webhook')}: ${feed.webhook.id}\n`
      : ''

    // Refresh rate
    const schedule = fetchedSchedules[index]
    let refreshRate = failRecord && failRecord.hasFailed()
      ? 'N/A'
      : schedule.refreshRateMinutes < 1
        ? `${schedule.refreshRateMinutes * 60} ${translate('commands.list.seconds')}`
        : `${schedule.refreshRateMinutes} ${translate('commands.list.minutes')}`
    // : translate('commands.list.unknown')

    // Patreon link
    if (Supporter.enabled && !supporter) {
      refreshRate += ' [－](https://www.patreon.com/discordrss)'
    }

    const name = `${title.length > 200 ? title.slice(0, 200) + '[...]' : title}`
    const value = `${titleChecks}${status}${translate('commands.list.refreshRate')}: ${refreshRate}\n${translate('generics.channelUpper')}: ${channel}\n${webhook}${translate('commands.list.link')}: ${url}`
    const number = feeds.indexOf(feed) + 1
    menu.addOption(name, value, number)
  })

  if (someFailed) {
    const failAlert = translate('commands.list.failAlert', {
      prefix: profile && profile.prefix ? profile.prefix : config.bot.prefix
    })
    menu.embed.setDescription(`${menu.embed.description}${failAlert}\n\u200b`)
  }

  return new MenuVisual(menu)
}

const prompt = new LocalizedPrompt(listFeedVisual)

exports.visual = listFeedVisual
exports.prompt = prompt

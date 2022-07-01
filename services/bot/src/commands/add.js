const getConfig = require('../config.js').get
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailRecord = require('../structs/db/FailRecord.js')
const Feed = require('../structs/db/Feed.js')
const Guild = require('../structs/Guild.js')
const BannedFeed = require('../structs/db/BannedFeed')
const createLogger = require('../util/logger/create.js')

module.exports = async (message) => {
  const guild = new Guild(message.guild.id)
  const [profile, maxFeedsAllowed] = await Promise.all([
    Profile.get(message.guild.id),
    guild.getMaxFeeds()
  ])

  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
  if (message.content.split(' ').length === 1) {
    // If there is no link after rssadd, return.
    return message.channel.send(translate('commands.add.correctSyntax', { prefix }))
  }

  const log = createLogger(message.guild.shard.id)
  let linkList = message.content.split(' ')
  linkList.shift()
  linkList = linkList.map(item => item.trim()).filter(item => item).join(' ').split('>')

  const passedAddLinks = []
  const failedAddLinks = {}
  const totalLinks = linkList.length
  let limitExceeded = false

  let checkedSoFar = 0

  const verifyMsg = await message.channel.send(translate('commands.add.processing'))

  // Start loop over links
  for (let i = 0; i < linkList.length; ++i) {
    const curLink = linkList[i]
    const linkItem = curLink.split(' ')
    const link = linkItem[0].trim()

    const associatedBannedFeed = await BannedFeed.findForUrl(link, message.guild.id)

    if (!link.startsWith('http')) {
      failedAddLinks[link] = translate('commands.add.improperFormat')

      continue
    } else if (maxFeedsAllowed !== 0 && feeds.length + checkedSoFar >= maxFeedsAllowed) {
      log.info({
        guild: message.guild
      }, `Unable to add feed ${link} due to limit of ${maxFeedsAllowed} feeds`)
      // Only show link-specific error if it's one link since they user may be trying to add a huge number of links that exceeds the message size limit
      if (totalLinks.length === 1) {
        failedAddLinks[link] = translate('commands.add.limitReached', { max: maxFeedsAllowed })
      } else {
        limitExceeded = true
      }

      continue
    } else if (associatedBannedFeed) {
      console.log(associatedBannedFeed)
      failedAddLinks[link] = translate('commands.add.bannedFeed', {
        reason: associatedBannedFeed.reason || 'unknown'
      })

      continue
    }

    for (const feed of feeds) {
      if (feed.url === link && message.channel.id === feed.channel) {
        failedAddLinks[link] = translate('commands.add.alreadyExists')
        continue
      }
    }
    linkItem.shift()

    try {
      const newFeed = new Feed({
        url: link,
        channel: message.channel.id,
        guild: message.guild.id
      })
      await newFeed.testAndSave(message.guild.shardID)
      log.info({
        guild: message.guild
      }, `Added ${link}`)
      FailRecord.reset(link).catch(err => log.error(err, `Unable to reset failed status for link ${link} after rssadd`))
      passedAddLinks.push(link)
      ++checkedSoFar
    } catch (err) {
      const channelErrMsg = err.message
      log.warn({
        error: err
      }, `Unable to add ${link}`)
      failedAddLinks[link] = channelErrMsg
    }
  }
  // End loop over links

  let msg = ''
  if (passedAddLinks.length > 0) {
    let successBox = translate('commands.add.success') + ':\n```\n'
    for (const passedLink of passedAddLinks) {
      successBox += `\n${passedLink}`
    }
    msg += successBox + '\n```\n'
  }
  if (Object.keys(failedAddLinks).length > 0) {
    let failBox = `\n${limitExceeded ? translate('commands.add.failedLimit', { max: maxFeedsAllowed }) : ''}${translate('commands.add.failedList')}:\n\`\`\`\n`
    for (const failedLink in failedAddLinks) {
      failBox += `\n\n${failedLink}\n${translate('commands.add.reason')}: ${failedAddLinks[failedLink]}`
    }
    msg += failBox + '\n```\n'
  } else if (limitExceeded) {
    msg += translate('commands.add.failedLimit', { max: maxFeedsAllowed })
  }
  if (passedAddLinks.length > 0) {
    msg += `${translate('commands.add.successInfo', { prefix })} ${translate('generics.backupReminder', { prefix })}`
  }

  await verifyMsg.edit(msg)
}

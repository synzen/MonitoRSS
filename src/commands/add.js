const channelTracker = require('../util/channelTracker.js')
const initialize = require('../rss/initialize.js')
const config = require('../config.js')
const log = require('../util/logger.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailCounter = require('../structs/db/FailCounter.js')
const Supporter = require('../structs/db/Supporter.js')
const Feed = require('../structs/db/Feed.js')

module.exports = async (bot, message) => {
  try {
    const [ profile, supporter ] = await Promise.all([
      Profile.get(message.guild.id),
      Supporter.getValidSupporterOfGuild(message.guild.id)
    ])
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const maxFeedsAllowed = supporter ? await supporter.getMaxFeeds() : config.feeds.max
    const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
    if (message.content.split(' ').length === 1) {
      // If there is no link after rssadd, return.
      return await message.channel.send(translate('commands.add.correctSyntax', { prefix }))
    }

    let linkList = message.content.split(' ')
    linkList.shift()
    linkList = linkList.map(item => item.trim()).filter(item => item).join(' ').split('>')

    const passedAddLinks = []
    const failedAddLinks = {}
    const totalLinks = linkList.length
    let limitExceeded = false

    channelTracker.add(message.channel.id)
    let checkedSoFar = 0

    const verifyMsg = await message.channel.send(translate('commands.add.processing'))

    // Start loop over links
    for (let i = 0; i < linkList.length; ++i) {
      const curLink = linkList[i]
      const linkItem = curLink.split(' ')
      let link = linkItem[0].trim()
      if (!link.startsWith('http')) {
        failedAddLinks[link] = translate('commands.add.improperFormat')
        continue
      } else if (maxFeedsAllowed !== 0 && feeds.length + checkedSoFar >= maxFeedsAllowed) {
        log.command.info(`Unable to add feed ${link} due to limit of ${maxFeedsAllowed} feeds`, message.guild)
        // Only show link-specific error if it's one link since they user may be trying to add a huge number of links that exceeds the message size limit
        if (totalLinks.length === 1) {
          failedAddLinks[link] = translate('commands.add.limitReached', { max: maxFeedsAllowed })
        } else {
          limitExceeded = true
        }
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
        const [ addedLink ] = await initialize.addNewFeed({ channel: message.channel, link })
        if (addedLink) {
          link = addedLink
        }
        channelTracker.remove(message.channel.id)
        log.command.info(`Added ${link}`, message.guild)
        FailCounter.reset(link).catch(err => log.general.error(`Unable to reset failed status for link ${link} after rssadd`, err))
        passedAddLinks.push(link)
        ++checkedSoFar
      } catch (err) {
        let channelErrMsg = err.message
        log.command.warning(`Unable to add ${link}`, message.guild, err)
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

    channelTracker.remove(message.channel.id)
    await verifyMsg.edit(msg)
  } catch (err) {
    log.command.warning(`Could not begin feed addition validation`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssadd 1', message.guild, err))
    channelTracker.remove(message.channel.id)
  }
}

const channelTracker = require('../util/channelTracker.js')
const initialize = require('../rss/initialize.js')
const config = require('../config.js')
const log = require('../util/logger.js')
const dbOps = require('../util/dbOps.js')
const serverLimit = require('../util/serverLimit.js')

module.exports = async (bot, message) => {
  try {
    const [ guildRss, serverLimitData ] = await Promise.all([ dbOps.guildRss.get(message.guild.id), serverLimit(message.guild.id) ])
    const rssList = guildRss && guildRss.sources ? guildRss.sources : {}
    const vipUser = serverLimitData.vipUser
    const maxFeedsAllowed = serverLimitData.max

    if (message.content.split(' ').length === 1) return await message.channel.send(`The correct syntax is \`${guildRss && guildRss.prefix ? guildRss.prefix : config.bot.prefix}rssadd https://www.some_url_here.com\`. Multiple links can be added at once, separated by \`>\`.`) // If there is no link after rssadd, return.

    let linkList = message.content.split(' ')
    linkList.shift()
    linkList = linkList.map(item => item.trim()).filter(item => item).join(' ').split('>')

    const passedAddLinks = []
    const failedAddLinks = {}
    const totalLinks = linkList.length
    let limitExceeded = false

    channelTracker.add(message.channel.id)
    let checkedSoFar = 0

    const verifyMsg = await message.channel.send('Processing...')

    // Start loop over links
    for (var i = 0; i < linkList.length; ++i) {
      const curLink = linkList[i]
      const linkItem = curLink.split(' ')
      let link = linkItem[0].trim()
      if (!link.startsWith('http')) {
        failedAddLinks[link] = 'Invalid/improperly-formatted link.'
        continue
      } else if (maxFeedsAllowed !== 0 && Object.keys(rssList).length + checkedSoFar >= maxFeedsAllowed) {
        log.command.info(`Unable to add feed ${link} due to limit of ${maxFeedsAllowed} feeds`, message.guild)
        // Only show link-specific error if it's one link since they user may be trying to add a huge number of links that exceeds the message size limit
        if (totalLinks.length === 1) failedAddLinks[link] = `Maximum feed limit of ${maxFeedsAllowed} has been reached.`
        else limitExceeded = true
        continue
      }

      for (var x in rssList) {
        if (rssList[x].link === link && message.channel.id === rssList[x].channel) {
          failedAddLinks[link] = 'Already exists for this channel.'
          continue
        }
      }
      linkItem.shift()

      try {
        const [ addedLink ] = await initialize.addNewFeed({ channel: message.channel, link, vipUser })
        if (addedLink) link = addedLink
        channelTracker.remove(message.channel.id)
        log.command.info(`Added ${link}`, message.guild)
        dbOps.failedLinks.reset(link).catch(err => log.general.error(`Unable to reset failed status for link ${link} after rssadd`, err))
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
      let successBox = 'The following feed(s) have been successfully added to **this channel**:\n```\n'
      for (const passedLink of passedAddLinks) successBox += `\n${passedLink}`
      msg += successBox + '\n```\n'
    }
    if (Object.keys(failedAddLinks).length > 0) {
      let failBox = `\n${limitExceeded ? `Feed(s) not listed here could not be added due to the feed limit (${maxFeedsAllowed}). ` : ''}The following feed(s) could not be added:\n\`\`\`\n`
      for (const failedLink in failedAddLinks) failBox += `\n\n${failedLink}\nReason: ${failedAddLinks[failedLink]}`
      msg += failBox + '\n```\n'
    } else if (limitExceeded) msg += `Some feed(s) could not be added due to to the feed limit (${maxFeedsAllowed}).`
    if (passedAddLinks.length > 0) msg += `Articles will be automatically delivered once new articles are found. After completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`

    channelTracker.remove(message.channel.id)
    await verifyMsg.edit(msg)
  } catch (err) {
    log.command.warning(`Could not begin feed addition validation`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssadd 1', message.guild, err))
    channelTracker.remove(message.channel.id)
  }
}

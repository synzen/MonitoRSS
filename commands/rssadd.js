const channelTracker = require('../util/channelTracker.js')
const initialize = require('../rss/initialize.js')
const config = require('../config.json')
const log = require('../util/logger.js')
const dbOps = require('../util/dbOps.js')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds

function sanitizeArray (array) {
  for (var p = array.length - 1; p >= 0; p--) { // Sanitize by removing spaces and newlines
    array[p] = array[p].trim()
    if (!array[p]) array.splice(p, 1)
  }
  return array
}

function isBotController (id) {
  const controllerList = config.bot.controllerIds
  if (typeof controllerList !== 'object') return false
  return controllerList.includes(id)
}

module.exports = async (bot, message) => {
  const guildRss = currentGuilds.has(message.guild.id) ? currentGuilds.get(message.guild.id) : {}
  const rssList = guildRss && guildRss.sources ? guildRss.sources : {}
  const maxFeedsAllowed = storage.vipServers[message.guild.id] && storage.vipServers[message.guild.id].benefactor.maxFeeds ? storage.vipServers[message.guild.id].benefactor.maxFeeds : !config.feeds.max || isNaN(parseInt(config.feeds.max)) ? 0 : config.feeds.max

  try {
    if (message.content.split(' ').length === 1) return await message.channel.send(`The correct syntax is \`${config.bot.prefix}rssadd https://www.some_url_here.com\`. Multiple links can be added at once, separated by \`>\`.`) // If there is no link after rssadd, return.

    let linkList = message.content.split(' ')
    linkList.shift()
    linkList = sanitizeArray(linkList.join(' ').split('>'))

    const passedAddLinks = {}
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
      let link = linkItem[0].trim() // One link may consist of the actual link, and its cookies
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

      let cookieString = linkItem.join(' ')
      var cookies = (cookieString && cookieString.startsWith('[') && cookieString.endsWith(']')) ? sanitizeArray(cookieString.slice(1, cookieString.length - 1).split(';')) : undefined
      if (cookies) {
        let cookieObj = {} // Convert cookie array into cookie object with key as key, and value as value
        for (var c in cookies) {
          let cookie = cookies[c].split('=')
          if (cookie.length === 2) cookieObj[cookie[0].trim()] = cookie[1].trim()
        }
        cookies = cookieObj
      }
      const cookiesFound = !!cookies
      if (config.advanced && config.advanced._restrictCookies === true && (!storage.vipServers[message.guild.id] || !storage.vipServers[message.guild.id].allowCookies) && !isBotController(message.author.id)) cookies = undefined

      try {
        const [ addedLink ] = await initialize.addNewFeed({link: link, channel: message.channel, cookies: cookies})
        if (addedLink) link = addedLink
        channelTracker.remove(message.channel.id)
        log.command.info(`Added ${link}`, message.guild)
        if (storage.failedLinks[link]) dbOps.failedLinks.reset(link).catch(err => log.general.error(`Unable to reset failed status for link ${link} after rssadd`, err))
        passedAddLinks[link] = cookies
        ++checkedSoFar
      } catch (err) {
        let channelErrMsg = err.message
        if (cookiesFound && !cookies) channelErrMsg += ' (Cookies were detected, but missing access for usage)'
        log.command.warning(`Unable to add ${link}.${cookiesFound && !cookies ? ' (Cookies found, access denied)' : ''}`, message.guild, err)
        failedAddLinks[link] = channelErrMsg
      }
    }
    // End loop over links

    let msg = ''
    if (Object.keys(passedAddLinks).length > 0) {
      let successBox = 'The following feed(s) have been successfully added to **this channel**:\n```\n'
      for (var passedLink in passedAddLinks) {
        successBox += `\n${passedLink}`
        if (passedAddLinks[passedLink]) { // passedAddLinks[passedLink] is the cookie object
          let cookieList = ''
          for (var cookieKey in passedAddLinks[passedLink]) cookieList += `\n${cookieKey} = ${passedAddLinks[passedLink][cookieKey]}`
          successBox += `\nCookies:${cookieList}`
        }
      }
      msg += successBox + '\n```\n'
    }
    if (Object.keys(failedAddLinks).length > 0) {
      let failBox = `\n${limitExceeded ? `Feed(s) not listed here could not be added due to the feed limit (${maxFeedsAllowed}). ` : ''}The following feed(s) could not be added:\n\`\`\`\n`
      for (var failedLink in failedAddLinks) {
        failBox += `\n\n${failedLink}\nReason: ${failedAddLinks[failedLink]}`
      }
      msg += failBox + '\n```\n'
    } else if (limitExceeded) msg += `Some feed(s) could not be added due to to the feed limit (${maxFeedsAllowed}).`
    if (Object.keys(passedAddLinks).length > 0) msg += `Articles will be automatically delivered once new articles are found. After completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`

    channelTracker.remove(message.channel.id)
    await verifyMsg.edit(msg)
  } catch (err) {
    log.command.warning(`Could not begin feed addition validation`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssadd 1', message.guild, err))
    channelTracker.remove(message.channel.id)
  }
}

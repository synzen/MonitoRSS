const channelTracker = require('../util/channelTracker.js')
const initialize = require('../rss/initialize.js')
const sqlConnect = require('../rss/sql/connect.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const overriddenGuilds = storage.overriddenGuilds
const cookieAccessors = storage.cookieAccessors

function sanitize (array) {
  for (var p = array.length - 1; p >= 0; p--) { // Sanitize by removing spaces and newlines
    array[p] = array[p].trim()
    if (!array[p]) array.splice(p, 1)
  }
  return array
}

function isBotController (authorId) {
  let controllerList = config.botSettings.controllerIds
  if (typeof controllerList !== 'object') return false
  for (var i in controllerList) {
    if (controllerList[i] === authorId) return true
  }
}

module.exports = function (bot, message) {
  const guildRss = (currentGuilds.has(message.guild.id)) ? currentGuilds.get(message.guild.id) : {}
  const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
  let maxFeedsAllowed = overriddenGuilds[message.guild.id] != null ? overriddenGuilds[message.guild.id] : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds
  if (maxFeedsAllowed === 0) maxFeedsAllowed = 'Unlimited'

  if (message.content.split(' ').length === 1) return message.channel.send(`The correct syntax is \`${config.botSettings.prefix}rssadd <link>\`. Multiple links can be added at once, separated by commas.`).then(m => m.delete(3000)).catch(err => console.log(`Promise Warning rssAdd 0: ${err}`)) // If there is no link after rssadd, return.

  let linkList = message.content.split(' ')
  linkList.shift()
  linkList = linkList.join(' ').split(',')

  linkList = sanitize(linkList)

  const passedLinks = {}
  const failedLinks = {}
  const totalLinks = linkList.length

  function finishLinkList (verifyMsg) {
    let msg = ''
    if (passedLinks.size() > 0) {
      let successBox = 'The following feed(s) have been successfully added:\n```\n'
      for (var passedLink in passedLinks) {
        successBox += `\n* ${passedLink}`
        if (passedLinks[passedLink]) { // passedLinks[passedLink] is the cookie object
          let cookieList = ''
          for (var cookieKey in passedLinks[passedLink]) cookieList += `\n${cookieKey} = ${passedLinks[passedLink][cookieKey]}`
          successBox += `\nCookies:${cookieList}`
        }
      }
      msg += successBox + '\n```\n\n'
    }
    if (failedLinks.size() > 0) {
      let failBox = 'The following feed(s) could not be added:\n```\n'
      for (var failedLink in failedLinks) {
        failBox += `\n\n* ${failedLink}\nReason: ${failedLinks[failedLink]}`
      }
      msg += failBox + '\n```'
    }

    channelTracker.remove(message.channel.id)
    verifyMsg.edit(msg).catch(err => console.log(`Promise Warning rssAdd 1: ${err}`))
  }

  channelTracker.add(message.channel.id)

  message.channel.send('Processing...')
  .then(function (verifyMsg) {
    (function processLink (linkIndex) { // A self-invoking function for each link
      const linkItem = linkList[linkIndex].split(' ')
      const link = linkItem[0].trim() // One link may consist of the actual link, and its cookies

      if (!link.startsWith('http')) {
        failedLinks[link] = 'Invalid/improperly-formatted link.'
        if (linkIndex + 1 < totalLinks) return processLink(linkIndex + 1)
        else return finishLinkList(verifyMsg)
      } else if (maxFeedsAllowed !== 'Unlimited' && rssList.size() >= maxFeedsAllowed) {
        console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Unable to add feed ${link} due to limit of ${maxFeedsAllowed} feeds.`)
        failedLinks[link] = `Maximum feed limit of ${maxFeedsAllowed} has been reached.`
        if (linkIndex + 1 < totalLinks) return processLink(linkIndex + 1)
        else return finishLinkList(verifyMsg)
      }

      for (var x in rssList) {
        if (rssList[x].link === link && message.channel.id === rssList[x].channel) {
          failedLinks[link] = 'Already exists for this channel.'
          if (linkIndex + 1 < totalLinks) return processLink(linkIndex + 1)
          else return finishLinkList(verifyMsg)
        }
      }

      const con = sqlConnect(init)

      function init () {
        linkItem.shift()

        let cookieString = linkItem.join(' ')
        var cookies = (cookieString && cookieString.startsWith('[') && cookieString.endsWith(']')) ? sanitize(cookieString.slice(1, cookieString.length - 1).split(';')) : undefined
        if (cookies) {
          let cookieObj = {} // Convert cookie array into cookie object with key as key, and value as value
          for (var c in cookies) {
            let cookie = cookies[c].split('=')
            if (cookie.length === 2) cookieObj[cookie[0].trim()] = cookie[1].trim()
          }
          cookies = cookieObj
        }
        var cookiesFound = !!cookies
        if (config.advanced && config.advanced.restrictCookies === true && !cookieAccessors.ids.includes(message.author.id) && !isBotController(message.author.id)) cookies = undefined

        initialize.addNewFeed(con, link, message.channel, cookies, function (err) {
          channelTracker.remove(message.channel.id)
          if (err) {
            let channelErrMsg = ''
            switch (err.type) {
              case 'request':
                channelErrMsg = 'Unable to connect to feed link'
                break
              case 'feedparser':
                channelErrMsg = 'Invalid feed. Be sure to first validate your feed online'
                break
              case 'database':
                channelErrMsg = 'Internal database error. Please try again'
                break
              default:
                channelErrMsg = 'No reason available'
            }
            // Reserve err.content for console logs, which are more verbose
            if (cookiesFound && !cookies) channelErrMsg += ' (Cookies were detected, but missing access for usage)'
            console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Unable to add ${link}.${cookiesFound && !cookies ? ' (Cookies found, access denied)' : ''} `, err.content.message || err.content)
            failedLinks[link] = channelErrMsg
          } else {
            console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Added ${link}.`)
            passedLinks[link] = cookies
          }
          sqlCmds.end(con, function (err) {
            if (err) console.log(err)
          })
          if (linkIndex + 1 < totalLinks) return processLink(linkIndex + 1)
          else return finishLinkList(verifyMsg)
        })
      }
    })(0)
  }).catch(err => {
    console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not begin feed addition validation. (${err})`)
    channelTracker.remove(message.channel.id)
  })
}

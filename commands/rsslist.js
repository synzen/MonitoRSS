const Discord = require('discord.js')
const config = require('../config.json')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const overriddenGuilds = storage.overriddenGuilds
const failedLinks = storage.failedLinks
const pageControls = require('../util/pageControls.js')

module.exports = function (bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('There are no existing feeds.').catch(err => console.log(`Promise Warning: chooseFeed 2: ${err}`))

  const rssList = guildRss.sources
  const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0
  let failedFeedCount = 0

  function getFeedStatus (link) {
    const failCount = failedLinks[link]
    if (!failCount || (typeof failCount === 'number' && failCount <= failLimit)) return `Status: OK ${failCount > Math.ceil(failLimit / 5) ? '(' + failCount + '/' + failLimit + ')' : ''}\n`
    else {
      failedFeedCount++
      return 'Status: FAILED\n'
    }
  }

  const maxFeedsAllowed = overriddenGuilds[message.guild.id] != null ? overriddenGuilds[message.guild.id] === 0 ? 'Unlimited' : overriddenGuilds[message.guild.id] : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 'Unlimited' : config.feedSettings.maxFeeds

  let embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor)
    .setAuthor('Current Active Feeds')
    .setDescription(`**Server Limit:** ${rssList.size()}/${maxFeedsAllowed}\u200b\n\u200b\n`)

  // Generate the info for each feed as an array, and push into another array
  const currentRSSList = []
  for (var rssName in rssList) {
    const feed = rssList[rssName]
    let o = {
      link: feed.link,
      title: feed.title,
      webhook: feed.webhook ? feed.webhook.id : undefined,
      channel: bot.channels.get(feed.channel) ? bot.channels.get(feed.channel).name : undefined,
      titleChecks: feed.titleChecks === true ? 'Title Checks: Enabled\n' : null
    }
    if (failLimit !== 0) o.status = getFeedStatus(feed.link)
    currentRSSList.push(o)
  }

  if (failedFeedCount) embedMsg.description += `**Attention!** Feeds that have reached ${failLimit} connection failure limit have been detected. They will no longer be retried until the bot instance is restarted. Please either remove, or use *${config.botSettings.prefix}rssrefresh* to try to reset its status.\u200b\n\u200b\n`

  const pages = []
  for (var x in currentRSSList) {
    const count = parseInt(x, 10) + 1
    const link = currentRSSList[x].link
    const title = currentRSSList[x].title
    const channelName = currentRSSList[x].channel
    const status = currentRSSList[x].status
    const titleChecks = currentRSSList[x].titleChecks
    const webhook = currentRSSList[x].webhook

    // 7 feeds per embed
    if ((count - 1) !== 0 && (count - 1) / 7 % 1 === 0) {
      pages.push(embedMsg)
      embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor).setDescription(`Page ${pages.length + 1}\n\u200b`)
    }

    embedMsg.addField(`${count})  ${title.length > 200 ? title.slice(0, 200) + '[...]' : title}`, `${titleChecks || ''}${status || ''}Channel: #${channelName}\n${webhook ? 'Webhook: ' + webhook + '\n' : ''}Link: ${link}`)
  }

  // Push the leftover results into the last embed
  pages.push(embedMsg)

  message.channel.send({embed: pages[0]})
  .then(m => {
    if (pages.length === 1) return
    m.react('◀')
    .then(rct => m.react('▶').catch(err => console.log(`yep2`, err)))
    .catch(err => console.log(`yep`, err))
    pageControls.add(m.id, pages)
  })
  .catch(err => console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed list. Reason: ${err}`))
}

const Discord = require('discord.js')
const config = require('../../config.json')
const commandList = require('../../util/commandList.json')
const channelTracker = require('../../util/channelTracker.js')
const storage = require('../../util/storage.js')
const currentGuilds = storage.currentGuilds
const overriddenGuilds = storage.overriddenGuilds
const failedLinks = storage.failedLinks
const pageControls = require('../../util/pageControls.js')
const MsgHandler = require('../../util/MsgHandler.js')

function getFeedStatus (link, failLimit) {
  const failCount = failedLinks[link]
  if (!failCount || (typeof failCount === 'number' && failCount <= failLimit)) return `Status: OK ${failCount > Math.ceil(failLimit / 10) ? '(' + failCount + '/' + failLimit + ')' : ''}\n`
  else return `Status: FAILED\n`
}

module.exports = function (bot, message, command, callback, miscOption, firstMsgHandler) { // miscOption is for rssoptions command, firstMsgHandler holds messages that happened before this
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('There are no existing feeds.').catch(err => console.log(`Promise Warning: chooseFeed 2: ${err}`))

  const rssList = guildRss.sources
  const maxFeedsAllowed = overriddenGuilds[message.guild.id] != null ? overriddenGuilds[message.guild.id] === 0 ? 'Unlimited' : overriddenGuilds[message.guild.id] : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds, 10))) ? 'Unlimited' : config.feedSettings.maxFeeds
  let embedMsg = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setAuthor('Feed Selection Menu')
    .setDescription(`**Server Limit:** ${rssList.size()}/${maxFeedsAllowed}\n**Channel:** #${message.channel.name}\n**Action**: ${command === 'rssoptions' ? commandList[command].options[miscOption] : commandList[command].action}\n\nChoose a feed to from this channel by typing the number to execute your requested action on. ${commandList[command].action === 'Feed Removal' ? 'You may select multiple feeds to remove by separation with commas. ' : ''}Type **exit** to cancel.\u200b\n\u200b\n`)

  const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0
  const currentRSSList = []

  for (var rssName in rssList) { // Generate the info for each feed as an object, and push into array to be used in pages that are sent
    let o = {link: rssList[rssName].link, rssName: rssName, title: rssList[rssName].title}
    if (commandList[command].action === 'Refresh Feed') o.status = getFeedStatus(rssList[rssName].link, failLimit)
    if (miscOption === 'imagePreviews' || miscOption === 'imageLinksExistence' || miscOption === 'checkTitles' || miscOption === 'checkDates') {
      const statusText = miscOption === 'imagePreviews' ? 'Image Link Previews: ' : miscOption === 'imageLinksExistence' ? 'Image Links Existence: ' : miscOption === 'checkTitles' ? 'Title Checks: ' : 'Date Checks: '
      let decision = ''

      const globalSetting = config.feedSettings[miscOption]
      decision = globalSetting ? `${statusText} Enabled\n` : `${statusText} Disabled\n`
      const specificSetting = rssList[rssName][miscOption]
      decision = typeof specificSetting !== 'boolean' ? decision : specificSetting === true ? `${statusText} Enabled\n` : `${statusText} Disabled\n`

      o[miscOption] = decision
    }
    if (message.channel.id === rssList[rssName].channel) currentRSSList.push(o)
  }

  if (currentRSSList.length === 0) return message.channel.send('No feeds assigned to this channel.').catch(err => console.log(`Promise Warning: chooseFeed 1: ${err}`))

  const msgHandler = new MsgHandler(bot, message) // For deletion at the end of a series of menus
  if (firstMsgHandler) msgHandler.merge(firstMsgHandler)

  const pages = []
  for (var x in currentRSSList) {
    const count = parseInt(x, 10) + 1
    const link = currentRSSList[x].link
    const title = currentRSSList[x].title
    const status = currentRSSList[x].status || ''
    const miscOption = currentRSSList[x].checkTitles || currentRSSList[x].imagePreviews || currentRSSList[x].imageLinksExistence || currentRSSList[x].checkDates || ''

    // 7 feeds per embed (AKA page)
    if ((count - 1) !== 0 && (count - 1) / 7 % 1 === 0) {
      pages.push(embedMsg)
      embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor).setDescription(`Page ${pages.length + 1}`)
    }
    embedMsg.addField(`${count})  ${title.length > 200 ? title.slice(0, 200) + ' [...]' : title}`, `${miscOption}${status}Link: ${link}`)
  }

  // Push the leftover results into the last embed
  pages.push(embedMsg)

  message.channel.send({embed: pages[0]})
  .then(m => {
    msgHandler.add(m)
    selectFeed()
    if (pages.length === 1) return
    m.react('◀').then(rct => {
      m.react('▶').then(rct2 => {
        pageControls.add(m.id, pages)
      }).catch(err => console.log(`Reaction Error: (${message.guild.id}, ${message.guild.name}) => Could not add emoticon >. Reason: `, err))
    }).catch(err => console.log(`Reaction Error: (${message.guild.id}, ${message.guild.name}) => Could not add emoticon <. Reason: `, err))
  }).catch(err => console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed selection list. Reason: `, err))

  // Only start message collector if all pages were sent
  function selectFeed () {
    const filter = m => m.author.id === message.author.id
    const collector = message.channel.createMessageCollector(filter, {time: 60000})
    channelTracker.add(message.channel.id)

    collector.on('collect', function (m) {
      msgHandler.add(m)
      let chosenOption = m.content
      if (chosenOption.toLowerCase() === 'exit') return collector.stop('Feed selection menu closed.')

      // Return an array of selected indices for feed removal
      if (commandList[command].action === 'Feed Removal') {
        let rawArray = chosenOption.split(',')

        for (var p = rawArray.length - 1; p >= 0; p--) { // Sanitize the input
          rawArray[p] = rawArray[p].trim()
          if (!rawArray[p]) rawArray.splice(p, 1)
        }

        let chosenOptionList = rawArray.filter(function (elem, index, self) { // Remove duplicates
          return index.toString() === self.indexOf(elem).toString()
        })

        let validChosens = []
        let invalidChosens = []

        for (var z in chosenOptionList) {
          let index = parseInt(chosenOptionList[z], 10) - 1
          if (isNaN(index) || index + 1 > currentRSSList.length || index + 1 < 1) invalidChosens.push(chosenOptionList[z])
          else validChosens.push(index)
        }

        if (invalidChosens.length > 0) return message.channel.send(`The number(s) \`${invalidChosens}\` are invalid. Try again.`).then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: chooseFeed 4: ${err}`))
        else {
          collector.stop()
          for (var q in validChosens) {
            validChosens[q] = currentRSSList[validChosens[q]].rssName
          }
          return callback(validChosens, msgHandler)
        }
      }

      // Return a single index for non feed removal actions
      const index = parseInt(chosenOption, 10) - 1

      if (isNaN(index) || index + 1 > currentRSSList.length || index + 1 < 1) return message.channel.send('That is not a valid number. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: chooseFeed 4: ${err}`))

      collector.stop()
      callback(currentRSSList[index].rssName, msgHandler)
    })
    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'user') return
      if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`)
      else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
      msgHandler.deleteAll(message.channel)
    })
  }
}

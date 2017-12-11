const Discord = require('discord.js')
const fileOps = require('../util/fileOps.js')
const chooseFeed = require('./util/chooseFeed.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const storage = require('../util/storage.js')
const MsgHandler = require('../util/MsgHandler.js')

module.exports = function (bot, message, command) {
  const currentGuilds = storage.currentGuilds
  const menu = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setAuthor('Miscellaneous Feed Options')
    .setDescription('\u200b\nPlease select an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n')
    .addField('1) Toggle Title Checks for a feed', `**Only enable this if necessary!** Default is ${config.feedSettings.checkTitles === true ? 'enabled.' : 'disabled.'} Title checks will ensure no article with the same title as a previous one will be sent for a specific feed.`)
    .addField('2) Toggle Image Link Previews for a feed', `Default is ${config.feedSettings.iamgePreviews === false ? 'disabled' : 'enabled'}. Toggle automatic Discord image link embedded previews for image links found inside placeholders such as {description}.`)
    .addField('3) Toggle Image Links Existence for a feed', `Default is ${config.feedSettings.imageLinksExistence === false ? 'disabled' : 'enabled'}. Remove image links found inside placeholders such as {description}. If disabled, all image \`src\` links in such placeholders will be removed.`)
    .addField('4) Toggle Date Checks for a feed', `Default is ${config.feedSettings.checkDates === false ? 'disabled' : 'enabled'}. Date checking ensures that articles that are ${config.feedSettings.cycleMaxAge} day(s) old or has invalid/no pubdates are't sent.`)

  const firstMsgHandler = new MsgHandler(bot, message)

  message.channel.send({embed: menu})
  .then(function (msgPrompt) {
    firstMsgHandler.add(msgPrompt)
    const filter = m => m.author.id === message.author.id
    const collector = message.channel.createMessageCollector(filter, {time: 240000})
    channelTracker.add(message.channel.id)

    collector.on('collect', function (m) {
      firstMsgHandler.add(m)
      if (m.content.toLowerCase() === 'exit') return collector.stop(`Miscellaneous Feed Options menu closed.`)

      if (m.content === '1' || m.content === '2' || m.content === '3' || m.content === '4') {
        const chosenProp = m.content === '1' ? 'checkTitles' : m.content === '2' ? 'imagePreviews' : m.content === '3' ? 'imageLinksExistence' : 'checkDates'
        collector.stop()
        chooseFeed(bot, message, command, function (rssName, msgHandler) {
          const guildRss = currentGuilds.get(m.guild.id)
          const rssList = guildRss.sources

          const globalSetting = config.feedSettings[chosenProp]
          const specificSetting = rssList[rssName][chosenProp]

          let followGlobal = false
          rssList[rssName][chosenProp] = typeof specificSetting === 'boolean' ? !specificSetting : !globalSetting

          const finalSetting = rssList[rssName][chosenProp]

          if (rssList[rssName][chosenProp] === globalSetting) {
            delete rssList[rssName][chosenProp]
            followGlobal = true
          }

          const prettyPropName = m.content === '1' ? 'Title Checks' : m.content === '2' ? 'Image Previews' : m.content === '3' ? 'Image Links Existence' : 'Date Checks'

          fileOps.updateFile(m.guild.id, guildRss)
          console.log(`${prettyPropName}: (${message.guild.id}, ${message.guild.name}) => ${finalSetting ? 'enabled' : 'disabled'} for feed linked ${rssList[rssName].link}. ${followGlobal ? 'Now following global settings.' : ''}`)
          message.channel.send(`${prettyPropName} have been ${finalSetting ? 'enabled' : 'disabled'} for <${rssList[rssName].link}>${followGlobal ? ', and is now following the global setting.' : '.'}`)

          msgHandler.deleteAll(message.channel)
        }, chosenProp, firstMsgHandler)
      } else return message.channel.send(`That is not a valid option. Please try again.`).then(m => firstMsgHandler.add(m))
    })

    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'user') return // Do not execute msgHandler.deleteAll if is user, since this means menu series proceeded to the next step and has not ended
      if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
      else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
      firstMsgHandler.deleteAll(message.channel)
    })
  }).catch(err => console.log(`Promise Warning: Could not send Miscellaneous RSS Options menu, reason: `, err))
}

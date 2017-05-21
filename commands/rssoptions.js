const Discord = require('discord.js')
const fileOps = require('../util/fileOps.js')
const chooseFeed = require('./util/chooseFeed.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const MsgHandler = require('../util/MsgHandler.js')

module.exports = function(bot, message, command) {
  const menu = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setAuthor('Miscellaneous RSS Options')
    .setDescription('\u200b\nPlease select an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n')
    .addField('1) Toggle title checks for a feed', `**Only enable this if necessary!** Title checks are by default ${config.feedSettings.checkTitles == true ? 'enabled.' : 'disabled.'} Title checks will ensure no article with the same title as a previous one will be sent for a specific feed.`)

  const firstMsgHandler = new MsgHandler(bot, message)

  message.channel.send({embed: menu})
  .then(function(msgPrompt) {
    firstMsgHandler.add(msgPrompt)
    const filter = m => m.author.id == message.author.id
    const collector = message.channel.createMessageCollector(filter,{time:240000})
    channelTracker.add(message.channel.id)

    collector.on('collect', function(m) {
      firstMsgHandler.add(m)
      if (m.content.toLowerCase() === 'exit') return collector.stop(`Miscellaneous RSS Options menu closed.`);

      if (m.content === '1') {
        collector.stop();
        chooseFeed(bot, message, command, function(rssName, msgHandler) {
          const guildRss = currentGuilds.get(m.guild.id)
          const rssList = guildRss.sources

          if (rssList[rssName].checkTitles == true) {
            delete rssList[rssName].checkTitles;
            fileOps.updateFile(m.guild.id, guildRss)
            console.log(`RSS Title Checks: (${message.guild.id}, ${message.guild.name}) => Disabled for feed linked ${rssList[rssName].link}`)
            message.channel.send(`Title checks have been disabled for <${rssList[rssName].link}>.`);
          }
          else {
            rssList[rssName].checkTitles = true;
            fileOps.updateFile(m.guild.id, guildRss)
            console.log(`RSS Title Checks: (${message.guild.id}, ${message.guild.name}) => Enabled for feed linked ${rssList[rssName].link}`)
            message.channel.send(`Title checks have been enabled for <${rssList[rssName].link}>.`);
          }

          msgHandler.deleteAll(message.channel)
        }, 'titleChecks', firstMsgHandler)
      }
      else return message.channel.send(`That is not a valid option. Please try again.`).then(m => firstMsgHandler.add(m));
    })

    collector.on('end', function(collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'user') return; // Do not execute msgHandler.deleteAll if is user, since this means menu series proceeded to the next step and has not ended
      if (reason == 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000));
      firstMsgHandler.deleteAll(message.channel)
    })

  }).catch(err => console.log(`Promise Warning: Could not send Miscellaneous RSS Options menu, reason: `, err))

}

const Discord = require('discord.js')
const fileOps = require('../util/fileOps.js')
const getIndex = require('./util/printFeeds.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/storage.js').currentGuilds

module.exports = function(bot, message, command) {
  const menu = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setAuthor('Miscellaneous RSS Options')
    .setDescription('\u200b\nPlease select an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n')
    .addField('1) Toggle title checks for a feed', `Title checks are by default ${config.feedSettings.checkTitles == true ? 'enabled.' : 'disabled.'} **Only enable this if necessary!** Title checks will ensure no article with the same title as a previous one will be sent for a specific feed.`)

  const validOptions = ['1'];

  message.channel.send({embed: menu})
  .then(function(prompt) {

    const filter = m => m.author.id == message.author.id
    const collector = message.channel.createMessageCollector(filter,{time:240000})

    collector.on('collect', function(m) {
      if (m.content.toLowerCase() === 'exit') return collector.stop(`Miscellaneous RSS Options menu closed.`);
      if (!validOptions.includes(m.content)) return message.channel.send(`That is not a valid option. Please try again.`);

      if (m.content === '1') {
        collector.stop();
        getIndex(bot, message, command, function(rssName) {
          const guildRss = currentGuilds.get(m.guild.id)
          const rssList = guildRss.sources

          if (rssList[rssName].checkTitles == true) {
            delete rssList[rssName].checkTitles;
            fileOps.updateFile(m.guild.id, guildRss)
            console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Title checks have been disabled for feed linked ${rssList[rssName].link}`)
            return message.channel.send(`Title checks have been disabled for <${rssList[rssName].link}>.`);
          }
          else {
            rssList[rssName].checkTitles = true;
            fileOps.updateFile(m.guild.id, guildRss)
            console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Title checks have been enabled for feed linked ${rssList[rssName].link}`)
            return message.channel.send(`Title checks have been enabled for <${rssList[rssName].link}>.`);
          }

        }, 'titleChecks')
      }
    })

    collector.on('end', function(collected, reason) {
      channelTracker.removeCollector(message.channel.id)
      if (reason == 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') return message.channel.send(reason);
    })

  }).catch(err => console.log(`Promise Warning: Could not send Miscellaneous RSS Options menu, reason: `, err))

}

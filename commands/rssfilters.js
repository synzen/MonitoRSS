const Discord = require('discord.js')
const filters = require('./util/filters.js')
const getIndex = require('./util/printFeeds.js')
const config = require('../config.json')
const fileOps = require('../util/fileOps.js')

module.exports = function(bot, message, command, role) {

  getIndex(bot, message, command, function(rssName) {
    var guildRss = require(`../sources/${message.guild.id}.json`)
    var rssList = guildRss.sources

    var menu = new Discord.RichEmbed()
      .setColor(config.botSettings.menuColor)
      .setAuthor('Feed Filters Customization')
      .setDescription(`**Feed Title:** ${rssList[rssName].title}\n**Feed Link:** ${rssList[rssName].link}\n\nSelect an option by typing its number, or type *exit* to cancel. Only messages that contain any of the words defined in these feed filters will be sent to Discord.\n_____`)
      .addField(`1) Add feed filter(s)`, `Add new filter(s) to a specific category in a feed.`)
      .addField(`2) Remove feed filter(s)`, `Remove existing filter(s), if any.`)
      .addField(`3) Remove all feed filters`, `Remove all filters, if any.`)
      .addField(`4) List existing filters`, `List all filters in all categories, if any.`)

    message.channel.sendEmbed(menu).catch(err => `Promise Warning: rssFilters 1: ${err}`)

    const filter = m => m.author.id == message.author.id;
    const collector = message.channel.createCollector(filter,{time:60000});

    collector.on('message', function(m) {
      if (m.content.toLowerCase() == 'exit') return collector.stop('RSS Filter Action selection menu closed.');
      else if (!['1', '2', '3', '4'].includes(m.content)) return message.channel.sendMessage('That is not a valid choice. Try again.').catch(err => `Promise Warning: rssFilters 5: ${err}`);
      // 1 = Add feed filters
      if (m.content == 1) {
        collector.stop();
        return filters.add(message, rssName);
      }
      // 2 = Remove feed filters
      else if (m.content == 2) {
        collector.stop();
        return filters.remove(message, rssName);
      }

      else if (m.content == 3 || m.content == 4) {
        collector.stop();
        var foundFilters = [];
        if (rssList[rssName].filters && typeof rssList[rssName].filters === 'object') {
          for (let prop in rssList[rssName].filters)
            if (rssList[rssName].filters.hasOwnProperty(prop) && prop !== 'roleSubscriptions') foundFilters.push(prop);
        }

        if (foundFilters.length === 0) return message.channel.sendMessage('There are no feed filters assigned to this feed.').catch(err => `Promise Warning: rssFilter 2: ${err}`);

        let filterList = rssList[rssName].filters;
        // 3 = Remove all feed filters
        if (m.content == 3) {
          for (let filterCategory in filterList) {
            if (filterCategory !== 'roleSubscriptions') delete filterList[filterCategory];
          }
          if (filterList.size() === 0) delete rssList[rssName].filters;
          fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`);
          return message.channel.sendMessage(`All feed filters have been successfully removed from this feed.`).catch(err => `Promise Warning: rssFilters 3: ${err}`);
        }
        // 4 = List all existing filters
        else if (m.content == 4) {

          var msg = new Discord.RichEmbed()
            .setColor(config.botSettings.menuColor)
            .setAuthor('List of Assigned Filters')
            .setDescription(`**Feed Title:** ${rssList[rssName].title}\n**Feed Link:** ${rssList[rssName].link}\n\nBelow are the filter categories with their words/phrases under each.\n_____`);

          // Generate the list of filters assigned to a feed and add to embed to be sent
          for (let filterCategory in filterList)  {
            let value = ''
            if (filterCategory !== 'roleSubscriptions') {
              for (let filter in filterList[filterCategory])
                value += `${filterList[filterCategory][filter]}\n`;
            }
            msg.addField(filterCategory, value, true)
          }
          return message.channel.sendEmbed(msg).catch(err => console.log(`Promise Warning: rssFilters 4: ${err}`));
        }
      }

    })

    collector.on('end', (collected, reason) => {
      if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') return message.channel.sendMessage(reason);
    })
  })
}

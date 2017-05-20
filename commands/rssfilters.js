const Discord = require('discord.js')
const filters = require('./util/filters.js')
const chooseFeed = require('./util/chooseFeed.js')
const config = require('../config.json')
const fileOps = require('../util/fileOps.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const getArticle = require('../rss/getArticle.js')
const sendToDiscord = require('../util/sendToDiscord.js')
const channelTracker = require('../util/channelTracker.js')

module.exports = function(bot, message, command, role) {

  chooseFeed(bot, message, command, function(rssName, msgHandler) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources
    const menu = new Discord.RichEmbed()
      .setColor(config.botSettings.menuColor)
      .setAuthor('Feed Filters Customization')
      .setDescription(`**Feed Title:** ${rssList[rssName].title}\n**Feed Link:** ${rssList[rssName].link}\n\nSelect an option by typing its number, or type *exit* to cancel. Only messages that contain any of the words defined in these feed filters will be sent to Discord.\u200b\n\u200b\n`)
      .addField(`1) Add feed filter(s)`, `Add new filter(s) to a specific category in a feed.`)
      .addField(`2) Remove feed filter(s)`, `Remove existing filter(s), if any.`)
      .addField(`3) Remove all feed filter(s)`, `Remove all filters, if any.`)
      .addField(`4) List existing filter(s)`, `List all filters in all categories, if any.`)
      .addField(`5) Send passing article`, `Send a randomly chosen article that passes currently specified filters.`)

    message.channel.send({embed: menu})
    .then(function(menu) {
      msgHandler.add(menu)
      const filter = m => m.author.id == message.author.id;
      const collector = message.channel.createMessageCollector(filter,{time:60000});
      channelTracker.add(message.channel.id)

      collector.on('collect', function(m) {
        msgHandler.add(m)
        if (m.content.toLowerCase() === 'exit') return collector.stop('Filter Action selection menu closed.');
        else if (!['1', '2', '3', '4', '5'].includes(m.content)) return message.channel.send('That is not a valid choice. Try again.').then(m => msgHandler.add(m)).catch(err => `Promise Warning: rssFilters 5: ${err}`);
        // 1 = Add feed filters
        if (m.content == 1) {
          collector.stop();
          return filters.add(message, rssName, null, msgHandler);
        }
        // 2 = Remove feed filters
        else if (m.content == 2) {
          collector.stop();
          return filters.remove(message, rssName, null, msgHandler);
        }

        else if (m.content == 3 || m.content == 4 || m.content == 5) {
          collector.stop();
          const foundFilters = [];
          if (rssList[rssName].filters && typeof rssList[rssName].filters === 'object') {
            for (var prop in rssList[rssName].filters)
              if (rssList[rssName].filters.hasOwnProperty(prop) && prop !== 'roleSubscriptions') foundFilters.push(prop);
          }

          if (foundFilters.length === 0) return message.channel.send(`There are no feed filters assigned to <${rssList[rssName].link}>.`).catch(err => `Promise Warning: rssFilter 2: ${err}`);

          const filterList = rssList[rssName].filters;
          // 3 = Remove all feed filters
          if (m.content == 3) {
            for (var filterCategory in filterList) {
              if (filterCategory !== 'roleSubscriptions') delete filterList[filterCategory];
            }
            if (filterList.size() === 0) delete rssList[rssName].filters;
            fileOps.updateFile(message.guild.id, guildRss);
            msgHandler.deleteAll(message.channel);
            return message.channel.send(`All feed filters have been successfully removed from <${rssList[rssName].link}>.`).catch(err => `Promise Warning: rssFilters 3: ${err}`);
          }
          // 4 = List all existing filters
          else if (m.content == 4) {

            const msg = new Discord.RichEmbed()
              .setColor(config.botSettings.menuColor)
              .setAuthor('List of Assigned Filters')
              .setDescription(`**Feed Title:** ${rssList[rssName].title}\n**Feed Link:** ${rssList[rssName].link}\n\nBelow are the filter categories with their words/phrases under each.\u200b\n\u200b\n`);

            // Generate the list of filters assigned to a feed and add to embed to be sent
            for (var filterCategory in filterList)  {
              let value = ''
              if (filterCategory !== 'roleSubscriptions') {
                for (var filter in filterList[filterCategory])
                  value += `${filterList[filterCategory][filter]}\n`;
              }
              msg.addField(filterCategory, value, true)
            }
            msgHandler.deleteAll(message.channel);
            return message.channel.send({embed: msg}).catch(err => console.log(`Promise Warning: rssFilters 4: ${err}`));
          }
          // 5 = Send passing article
          else if (m.content == 5) {
            getArticle(message.guild.id, rssName, true, function(err, article) {
              if (err) {
                let channelErrMsg = '';
                switch(err.type) {
                  case 'request':
                    channelErrMsg = 'Unable to connect to feed link';
                    break;
                  case 'feedparser':
                    channelErrMsg = 'Invalid feed';
                    break;
                  case 'database':
                    channelErrMsg = 'Internal database error. Please try again';
                    break;
                  case 'deleted':
                    channelErrMsg = 'Feed missing from database'
                  default:
                    channelErrMsg = 'No reason available';
                }
                console.log(`RSS Warning: Unable to send filtered test article '${err.feed.link}'. Reason: ${err.content}`); // Reserve err.content for console logs, which are more verbose
                msgHandler.deleteAll()
                return message.channel.send(`Unable to grab feed article for feed ${err.feed.link}. Reason: ${channelErrMsg}.`);
              }
              console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Sending filtered article for ${rssList[rssName].link}`);
              article.rssName = rssName;
              article.discordChannelId = message.channel.id;
              sendToDiscord(bot, article, function(err) {
                if (err) console.log(err);
                msgHandler.deleteAll(message.channel);
              });
            })
          }
        }
      })

      collector.on('end', function(collected, reason) {
        channelTracker.add(message.channel.id)
        if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000));
      })
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send filters customization menu. (${err})`))
  })
}

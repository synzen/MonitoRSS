const filterAdd = require('./filterAdd.js')
const filterRemove = require('./filterRemove.js')
const rssConfig = require('../config.json')
const fileOps = require('../util/updateJSON.js')

function isEmptyObject(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return JSON.stringify(obj) === JSON.stringify({});
}

module.exports = function(message, rssIndex, role) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  var menu = {embed: {
    color: rssConfig.menuColor,
    description: `**Feed Title:** ${rssList[rssIndex].title}\n**Feed Link:** ${rssList[rssIndex].link}\n\nSelect an option by typing its number, or type *exit* to cancel. Only messages that contain any of the words defined in these global filters will be sent to Discord.\n_____`,
    author: {name: `Global Filters Customization`},
    fields: [{name: `1) Add a global filter`, value: `Add a new filter to a specific category.`},
            {name: `2) Remove a global filter`, value: `Remove an existing filter, if any.`},
            {name: `3) Remove all global filters`, value: `Remove all filters, if any.`},
            {name: `4) List existing filters`, value: `List all filters in all categories, if any.`}],
    footer: {}
  }}

  message.channel.sendMessage("", menu)

  const filter = m => m.author.id == message.author.id;
  const collector = message.channel.createCollector(filter,{time:60000});

  collector.on('message', function (m) {
    if (m.content.toLowerCase() == "exit") return collector.stop("RSS Filter Action selection menu closed.");
    if (m.content == 1) {
      collector.stop();
      return filterAdd(message, rssIndex);
    }
    else if (m.content == 2) {
      collector.stop();
      return filterRemove(message, rssIndex);
    }
    else if (m.content == 3 || m.content == 4) {
      collector.stop();
      var foundFilters = [];
      if (rssList[rssIndex].filters != null && typeof rssList[rssIndex].filters == "object") {
        for (let prop in rssList[rssIndex].filters)
          if (rssList[rssIndex].filters.hasOwnProperty(prop) && prop !== "roleSubscriptions") foundFilters.push(prop);
      }

      if (foundFilters.length == 0) return message.channel.sendMessage("There are no global filters assigned to this feed.");

      let filterList = rssList[rssIndex].filters;
      if (m.content == 3) {
        for (let filterCategory in filterList) {
          if (filterCategory !== "roleSubscriptions") delete filterList[filterCategory];
        }
        if (isEmptyObject(filterList)) delete rssList[rssIndex].filters;
        fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`);
        return message.channel.sendMessage(`All global filters have been successfully removed from this feed.`);
      }
      else if (m.content == 4) {

        var msg = {embed: {
          color: rssConfig.menuColor,
          description: `**Feed Title:** ${rssList[rssIndex].title}\n**Feed Link:** ${rssList[rssIndex].link}\n\nBelow are the filter categories with their words/phrases under each.\n_____`,
          author: {name: `List of Assigned Filters`},
          fields: [],
          footer: {}
        }}

        for (let filterCategory in filterList)  {
          var field = {name: filterCategory, value: "", inline: true};
          if (filterCategory !== "roleSubscriptions") {
            for (let filter in filterList[filterCategory])
              field.value += `${filterList[filterCategory][filter]}\n`;
          }
          msg.embed.fields.push(field);
        }
        message.channel.sendMessage("", msg).catch(err => {
          console.log("promise error! cannot send embed of filters listings, the embed is: \n", msg.embed, "\n\nthe fields is:\n", msg.fields)
        });
      }
    }
    else message.channel.sendMessage("That is not a valid choice. Try again.");
  })

  collector.on('end', (collected, reason) => {
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
    else if (reason !== "user") return message.channel.sendMessage(reason);
  })
}

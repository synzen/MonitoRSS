const fileOps = require('../util/updateJSON.js')
const rssConfig = require('../config.json')

module.exports = function(message, rssIndex, role) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  if (rssList[rssIndex].filters == null || rssList[rssIndex].filters == "") rssList[rssIndex].filters = {};
  if (role != null && rssList[rssIndex].filters.roleSubscriptions == null) rssList[rssIndex].filters.roleSubscriptions = {};
  if (role != null && rssList[rssIndex].filters.roleSubscriptions[role.id] == null)
    rssList[rssIndex].filters.roleSubscriptions[role.id] = {
      roleName: role.name,
      filters: {}
    }

  //recycled from filterRemove.js
  if (role == null) var filterList = rssList[rssIndex].filters;
  else var filterList = rssList[rssIndex].filters.roleSubscriptions[role.id].filters;

  let filterObj = {
    Title: {exists: false, loc: filterList.Title},
    Description: {exists: false, loc: filterList.Description},
    Summary: {exists: false, loc: filterList.Summary},
    Author: {exists: false, loc: filterList.Author}
  }

  var msg = `\`\`\`Markdown\n# Chosen Feed: ${rssList[rssIndex].link}\n# List of available filters to add\`\`\`\`\`\`Markdown\n`

  for (let filterType in filterObj) {
    msg += `\n[Filter Category]: ${filterType}\n`;
  }

  message.channel.sendMessage(msg + "```\n**Type the filter category for which you would like you add a filter to, or type exit to cancel.**");

  const filter = m => m.author.id == message.author.id;
  const filterTypeCollect = message.channel.createCollector(filter,{time:240000});
  filterTypeCollect.on('message', function (filterType) {
    if (filterType.content == "exit") return filterTypeCollect.stop("RSS Filter Addition menu closed.");
    var validFilterType = false;

    for (let a in filterObj) {
      if (filterType.content.toLowerCase() == a.toLowerCase()) {
        var chosenFilterType = a;
        validFilterType = true;
      }
    }


    if (!validFilterType) return message.channel.sendMessage("That is not a valid filter category. Try again.");
    else if (validFilterType) {
      filterTypeCollect.stop();
      message.channel.sendMessage(`Type the filter word/phrase you would like to add in the category \`${chosenFilterType}\` by typing it, or type \`{exit}\` to cancel. The filter will be applied as **case insensitive** to feeds.`)

      const filterCollect = message.channel.createCollector(filter,{time:240000});
      filterCollect.on('message', function(chosenFilter) {
        if (chosenFilter.content == "{exit}") return filterCollect.stop("RSS Filter Addition menu closed.");
        else {
          if (role != null) {
            try {delete rssList[rssIndex].roleSubscriptions} catch(e) {}
          }
          if (filterList[chosenFilterType] == null || filterList[chosenFilterType] == "") filterList[chosenFilterType] = [];
          message.channel.startTyping();
          filterCollect.stop();
          filterList[chosenFilterType].push(chosenFilter.content);
          fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`);
          message.channel.stopTyping();
          if (role == null) {
            console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => New filter '${chosenFilter.content}' added to '${chosenFilterType}' for ${rssList[rssIndex].link}.`);
            return message.channel.sendMessage(`The filter \`${chosenFilter.content}\` has been successfully added for the filter category \`${chosenFilterType}\` for the feed ${rssList[rssIndex].link}. You may test your filters via \`${rssConfig.prefix}rsstest\` and see what kind of feeds pass through.`);
          }
          else {
            console.log(`RSS Role Customization: (${message.guild.id}, ${message.guild.name}) => Role (${role.id}, ${role.name}) => New filter '${chosenFilter.content}' added to '${chosenFilterType}' for ${rssList[rssIndex].link}.`);
            return message.channel.sendMessage(`Subscription updated for role \`${role.name}\`. The filter \`${chosenFilter.content}\` has been successfully added for the filter category \`${chosenFilterType}\` for the feed ${rssList[rssIndex].link}. You may test your filters via \`${rssConfig.prefix}rsstest\` and see what kind of feeds pass through.`);

          }
        }
      })
      filterCollect.on('end', (collected, reason) => {
        if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
        else if (reason !== "user") return message.channel.sendMessage(reason);
      });
    }

  })
  filterTypeCollect.on('end', (collected, reason) => {
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
    else if (reason !== "user") return message.channel.sendMessage(reason);
  });


}

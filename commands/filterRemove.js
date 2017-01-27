const fileOps = require('../util/updateJSON.js')
const rssConfig = require('../config.json')

function isEmptyObject(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return JSON.stringify(obj) === JSON.stringify({});
}

function getObjLength(obj) {
  var count = 0

  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) count++;
  }

  return count
}

module.exports = function(message, rssIndex, role) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  if (role == null) var filterList = rssList[rssIndex].filters;
  else var filterList = rssList[rssIndex].filters.roleSubscriptions[role.id].filters;

  if (filterList == null || filterList == "") return message.channel.sendMessage(`There are no filters to remove for ${rssList[rssIndex].link}.`);

  let filterObj = {
    Title: {exists: false, loc: filterList.Title},
    Description: {exists: false, loc: filterList.Description},
    Summary: {exists: false, loc: filterList.Summary},
    Author: {exists: false, loc: filterList.Author}
  }

  var isEmptyFilter = true;
  for (let x in filterList) {
    for (let y in filterObj) {
      if (x == y && filterList[x] != null && filterList[x] !== "" && filterList[x].length != 0) {
        filterObj[y].exists = true;
        isEmptyFilter = false;
      }
    }
  }

  if (isEmptyFilter) return message.channel.sendMessage(`There are no filters to remove for ${rssList[rssIndex].link}.`);

  var msg = `\`\`\`Markdown\n# Chosen Feed: ${rssList[rssIndex].link}\n# List of current filters\`\`\`\`\`\`Markdown\n`

  for (let filterType in filterObj) {
    if (filterObj[filterType].exists == true) {
      msg += `\n[Filter Category]: ${filterType}\n`;
      for (let filter in filterObj[filterType].loc) {
        msg += filterObj[filterType].loc[filter] + "\n";
      }
    }
  }

  message.channel.sendMessage(msg + "```\n**Type the filter category for which you would like you remove a filter from, type \`{reset}\` to remove all filters, or type exit to cancel.**");

  const filter = m => m.author.id == message.author.id;
  const filterTypeCollect = message.channel.createCollector(filter,{time:240000});
  filterTypeCollect.on('message', function (filterType) {
    if (filterType.content == "exit") return filterTypeCollect.stop("RSS Filter Removal menu closed.");

    var validFilterType = false;

    for (let a in filterObj) {
      if (filterType.content.toLowerCase() == a.toLowerCase()) {
        var chosenFilterType = a;
        validFilterType = true;
      }
    }

    if (chosenFilterType == "{reset}") {
      message.channel.startTyping();
      filterTypeCollect.stop();
      delete filterList;
      fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`);
      message.channel.stopTyping();
      return message.channel.sendMessage("All filters have been removed.")//.then(m => m.channel.stopTyping());
    }
    else if (!validFilterType) return message.channel.sendMessage("That is not a valid filter category. Try again.");
    else if (validFilterType) {
      filterTypeCollect.stop();
      message.channel.sendMessage(`Confirm the filter word/phrase you would like to remove in the category \`${chosenFilterType}\` by typing it (case sensitive).`)

      const filterCollect = message.channel.createCollector(filter,{time:240000});
      filterCollect.on('message', function(chosenFilter) {
        var validFilter = false
        let chosenFilterTypeList = filterList[chosenFilterType]

        //if (typeof chosenFilterTypeList == "object")
        for (var filterIndex in chosenFilterTypeList) {
          if (chosenFilterTypeList[filterIndex] == chosenFilter.content) validFilter = [true, filterIndex];
        }

        if (chosenFilter.content == "exit") return filterCollect.stop("RSS Filter Removal menu closed.");
        else if (!validFilter) {
          return message.channel.sendMessage(`That is not a valid filter to remove from \`${chosenFilterType}\`. Try again.`);
        }
        else if (validFilter !== false) {
          message.channel.startTyping();
          filterCollect.stop();
          if (typeof validFilter == "object") {
            filterList[chosenFilterType].splice(validFilter[1], 1);
            if (filterList[chosenFilterType].length == 0) delete filterList[chosenFilterType];
          }
          else delete filterList[chosenFilterType];
          if (role != null && isEmptyObject(filterList)) delete rssList[rssIndex].filters.roleSubscriptions[role.id];
          if (role != null && isEmptyObject(rssList[rssIndex].filters.roleSubscriptions)) delete rssList[rssIndex].filters.roleSubscriptions;
          if (isEmptyObject(rssList[rssIndex].filters)) {
            delete rssList[rssIndex].filters;
          }
          fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`);
          message.channel.stopTyping();
          if (role == null) {
            console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Filter '${chosenFilter.content}' removed from '${chosenFilterType}' for ${rssList[rssIndex].link}.`);
            return message.channel.sendMessage(`The filter \`${chosenFilter.content}\` has been successfully removed from the filter category \`${chosenFilterType}\` for the feed ${rssList[rssIndex].link}.`);
          }
          else {
            console.log(`RSS Role Customization: (${message.guild.id}, ${message.guild.name}) => Role (${role.id}, ${role.name}) => Filter '${chosenFilter.content}' removed from '${chosenFilterType}' for ${rssList[rssIndex].link}.`);
            return message.channel.sendMessage(`Subscription updated for role \`${role.name}\`. The filter \`${chosenFilter.content}\` has been successfully removed from the filter category \`${chosenFilterType}\` for the feed ${rssList[rssIndex].link}.`);
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

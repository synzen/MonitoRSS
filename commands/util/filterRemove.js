const fileOps = require('../../util/updateJSON.js')
const config = require('../../config.json')
const channelTracker = require('../../util/channelTracker.js')

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
  var guildRss = require(`../../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  //null role = not adding a filter for a role
  if (role == null) var filterList = rssList[rssIndex].filters;
  else var filterList = rssList[rssIndex].filters.roleSubscriptions[role.id].filters;

  if (filterList == null || typeof filterList !== 'object') return message.channel.sendMessage(`There are no filters to remove for ${rssList[rssIndex].link}.`);

  let filterObj = {
    Title: {exists: false, loc: filterList.Title},
    Description: {exists: false, loc: filterList.Description},
    Summary: {exists: false, loc: filterList.Summary},
    Author: {exists: false, loc: filterList.Author}
  }

  var isEmptyFilter = true;

  if (rssList[rssIndex].filters != null && typeof rssList[rssIndex].filters == "object") {
    for (let prop in rssList[rssIndex].filters)
      if (rssList[rssIndex].filters.hasOwnProperty(prop) && prop !== "roleSubscriptions") isEmptyFilter = false;
  }

  if (role == null && isEmptyFilter) return message.channel.sendMessage(`There are no filters to remove for ${rssList[rssIndex].link}.`);

  var msg = {embed: {
    color: config.botSettings.menuColor,
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
  message.channel.sendMessage("**Type the filter category for which you would like you remove a filter from, type \`{reset}\` to remove all filters, or type exit to cancel.**", msg)

  const filter = m => m.author.id == message.author.id
  const filterTypeCollect = message.channel.createCollector(filter,{time:240000})
  channelTracker.addCollector(message.channel.id)

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
      let resetMsg = message.channel.sendMessage(`Resetting all filters...`)
      filterTypeCollect.stop();
      delete filterList;
      fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`);
      return resetMsg.then(m => m.edit("All filters have been removed."));
    }
    else if (!validFilterType) return message.channel.sendMessage("That is not a valid filter category. Try again.");
    else if (validFilterType) {
      filterTypeCollect.stop();
      message.channel.sendMessage(`Confirm the filter word/phrase you would like to remove in the category \`${chosenFilterType}\` by typing it (case sensitive).`);

      const filterCollect = message.channel.createCollector(filter,{time:240000});
      channelTracker.addCollector(message.channel.id)

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
          let editing = message.channel.sendMessage(`Removing filter ${chosenFilter.content} from category ${chosenFilterType}...`);
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
          fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`);
          if (role == null) {
            console.log(`RSS Global Filters: (${message.guild.id}, ${message.guild.name}) => Filter '${chosenFilter.content}' removed from '${chosenFilterType}' for ${rssList[rssIndex].link}.`);
            return editing.then(m => m.edit(`The filter \`${chosenFilter.content}\` has been successfully removed from the filter category \`${chosenFilterType}\` for the feed ${rssList[rssIndex].link}.`));
          }
          else {
            console.log(`RSS Roles: (${message.guild.id}, ${message.guild.name}) => Role (${role.id}, ${role.name}) => Filter '${chosenFilter.content}' removed from '${chosenFilterType}' for ${rssList[rssIndex].link}.`);
            return editing.then(m => m.edit(`Subscription updated for role \`${role.name}\`. The filter \`${chosenFilter.content}\` has been successfully removed from the filter category \`${chosenFilterType}\` for the feed ${rssList[rssIndex].link}.`));
          }
        }
      })
      filterCollect.on('end', (collected, reason) => {
        channelTracker.removeCollector(message.channel.id)
        if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== "user") return message.channel.sendMessage(reason);
      });
    }
  })
  filterTypeCollect.on('end', (collected, reason) => {
    channelTracker.removeCollector(message.channel.id)
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
    else if (reason !== "user") return message.channel.sendMessage(reason);
  });


}

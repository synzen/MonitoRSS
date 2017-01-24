const fileOps = require('../util/updateJSON.js')
const rssConfig = require('../config.json')

function isEmptyObject(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return JSON.stringify(obj) === JSON.stringify({});
}

module.exports = function(message, rssIndex) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  var filterList = rssList[rssIndex].filters;

  if (filterList == null || filterList == "") return message.channel.sendMessage(`There are no filters to remove for ${rssList[rssIndex].link}.`);

  let filterObj = {
    title: {exists: false, loc: filterList.title},
    description: {exists: false, loc: filterList.description},
    summary: {exists: false, loc: filterList.summary},
    author: {exists: false, loc: filterList.author}
  }

  var isEmptyFilter = true;
  for (let x in rssList[rssIndex].filters) {
    for (let y in filterObj) {
      if (x == y && rssList[rssIndex].filters[x] != null && rssList[rssIndex].filters[x] !== "" && rssList[rssIndex].filters[x].length != 0) {
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
  filterTypeCollect.on('message', function (chosenFilterType) {
    var validFilterType = false;
    for (let a in filterObj) if (chosenFilterType.content.toLowerCase() == a) validFilterType = true;

    if (chosenFilterType.content == "exit") return filterTypeCollect.stop("RSS Filter Removal menu closed.");
    else if (chosenFilterType.content == "{reset}") {
      message.channel.startTyping();
      filterTypeCollect.stop();
      delete rssList[rssIndex].filters;
      fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`);
      message.channel.stopTyping();
      return message.channel.sendMessage("All filters have been removed.")//.then(m => m.channel.stopTyping());
    }
    else if (!validFilterType) return message.channel.sendMessage("That is not a valid filter category. Try again.");
    else if (validFilterType) {
      filterTypeCollect.stop();
      message.channel.sendMessage(`Confirm the filter word/phrase you would like to remove in the category \`${chosenFilterType.content.toLowerCase()}\` by typing it (case sensitive).`)

      const filterCollect = message.channel.createCollector(filter,{time:240000});
      filterCollect.on('message', function(chosenFilter) {
        var validFilter = false
        let chosenFilterTypeList = rssList[rssIndex].filters[chosenFilterType.content.toLowerCase()]

        if (typeof chosenFilterTypeList == "object")
          for (var filterIndex in chosenFilterTypeList) {
            if (chosenFilterTypeList[filterIndex] == chosenFilter.content) validFilter = [true, filterIndex];
          }
        else if (typeof chosenFilterTypeList == "string")
          if (chosenFilterTypeList == chosenFilter.content) validFilter = true;

        if (chosenFilter.content == "exit") return filterCollect.stop("RSS Filter Removal menu closed.");
        else if (!validFilter) {
          return message.channel.sendMessage(`That is not a valid filter to remove from \`${chosenFilterType}\`. Try again.`);
        }
        else if (validFilter !== false) {
          message.channel.startTyping();
          filterCollect.stop();
          if (typeof validFilter == "object") {
            rssList[rssIndex].filters[chosenFilterType.content].splice(validFilter[1], 1);
            if (rssList[rssIndex].filters[chosenFilterType.content].length == 0) delete rssList[rssIndex].filters[chosenFilterType.content];
          }
          else delete rssList[rssIndex].filters[chosenFilterType.content];
          if (isEmptyObject(rssList[rssIndex].filters)) delete rssList[rssIndex].filters;
          fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`);
          console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Filter '${chosenFilter.content}' removed from '${chosenFilterType.content}' for ${rssList[rssIndex].link}.`);
          message.channel.stopTyping();
          return message.channel.sendMessage(`The filter \`${chosenFilter.content}\` has been successfully removed from the filter category \`${chosenFilterType.content}\` for the feed ${rssList[rssIndex].link}.`);
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

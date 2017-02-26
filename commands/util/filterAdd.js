const fileOps = require('../../util/updateJSON.js')
const config = require('../../config.json')
const channelTracker = require('../../util/channelTracker.js')

module.exports = function(message, rssIndex, role) {
  var guildRss = require(`../../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  if (!rssList[rssIndex].filters) rssList[rssIndex].filters = {};
  if (role && !rssList[rssIndex].filters.roleSubscriptions) rssList[rssIndex].filters.roleSubscriptions = {};
  if (role && !rssList[rssIndex].filters.roleSubscriptions[role.id])
    rssList[rssIndex].filters.roleSubscriptions[role.id] = {
      roleName: role.name,
      filters: {}
    }

  var filterList = (role) ? rssList[rssIndex].filters.roleSubscriptions[role.id].filters : rssList[rssIndex].filters
  var validFilterTypes = ['Title', 'Description', 'Summary', 'Author', 'Tag']
  var msg = `\`\`\`Markdown\n# Chosen Feed: ${rssList[rssIndex].link}\n# List of available filters to add\`\`\`\`\`\`Markdown\n`
  for (let filterType in validFilterTypes) {
    msg += `\n[Filter Category]: ${validFilterTypes[filterType]}\n`;
  }

  message.channel.sendMessage(msg + '```\n**Type the filter category for which you would like you add a filter to, or type exit to cancel.**').catch(err => console.log(`Promise Warning: filterAdd 1: ${err}`))

  const filter = m => m.author.id == message.author.id
  const filterTypeCollect = message.channel.createCollector(filter,{time:240000})
  channelTracker.addCollector(message.channel.id)

  filterTypeCollect.on('message', function (filterType) {
    if (filterType.content == 'exit') return filterTypeCollect.stop('Feed Filter Addition menu closed.');
    var chosenFilterType = '';

    for (let a in validFilterTypes) {
      if (filterType.content.toLowerCase() == validFilterTypes[a].toLowerCase()) chosenFilterType = validFilterTypes[a];
    }


    if (!chosenFilterType) return message.channel.sendMessage('That is not a valid filter category. Try again.').catch(err => console.log(`Promise Warning: filterAdd 2: ${err}`));
    else {
      filterTypeCollect.stop();
      message.channel.sendMessage(`Type the filter word/phrase you would like to add in the category \`${chosenFilterType}\` by typing it, type multiple word/phrases on different lines to add more than one, or type \`{exit}\` to cancel. The filter will be applied as **case insensitive** to feeds.`).catch(err => console.log(`Promise Warning: filterAdd 3: ${err}`));

      const filterCollect = message.channel.createCollector(filter,{time:240000});
      channelTracker.addCollector(message.channel.id);

      filterCollect.on('message', function(chosenFilter) {
        if (chosenFilter.content == '{exit}') return filterCollect.stop('Feed Filter Addition menu closed.');
        else {
          if (!role) delete rssList[rssIndex].roleSubscriptions;
          if (!filterList[chosenFilterType]) filterList[chosenFilterType] = [];
          message.channel.sendMessage(`Updating filters...`)
          .then(editing => {
            filterCollect.stop()
            var addList = chosenFilter.content.trim().split('\n')
            var addedList = ''
            var invalidItems = ''
            for (var item in addList) {
              if (!filterList[chosenFilterType].includes(addList[item].trim()) && addList[item].trim()) {
                filterList[chosenFilterType].push(addList[item].trim());
                addedList += `\n${addList[item].trim()}`;
              }
              else invalidItems += `\n${addList[item]}`;
            }
            fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`)
            if (!role) {
              console.log(`RSS Global Filters: (${message.guild.id}, ${message.guild.name}) => New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${rssList[rssIndex].link}.`);
              let msg = `The following filter(s) have been successfully added for the filter category \`${chosenFilterType}\`:\`\`\`\n\n${addedList}\`\`\``;
              if (invalidItems) msg += `\n\nThe following filter(s) could not be added because they already exist:\n\`\`\`\n\n${invalidItems}\`\`\``;
              editing.edit(`${msg}\n\nYou may test your filters via \`${config.botSettings.prefix}rsstest\` and see what feeds pass through.`).catch(err => console.log(`Promise Warning: filterAdd 4a: ${err}`));
            }
            else {
              console.log(`RSS Roles: (${message.guild.id}, ${message.guild.name}) => Role (${role.id}, ${role.name}) => New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${rssList[rssIndex].link}.`);
              let msg = `Subscription updated for role \`${role.name}\`. The following filter(s) have been successfully added for the filter category \`${chosenFilterType}\`:\`\`\`\n\n${addedList}\`\`\``;
              if (invalidItems) msg += `\n\nThe following filter(s) could not be added because they already exist:\n\`\`\`\n\n${invalidItems}\`\`\``;
              editing.edit(`${msg}\n\nYou may test your filters via \`${config.botSettings.prefix}rsstest\` and see what feeds will mention the role`).catch(err => console.log(`Promise Warning: filterAdd 4b: ${err}`));
            }
          })
          .catch(err => console.log(`Promise Warning: filterAdd 4: ${err}`));
        }
      });
      filterCollect.on('end', (collected, reason) => {
        channelTracker.removeCollector(message.channel.id)
        if (reason == 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') return message.channel.sendMessage(reason);
      });
    }
  })

  filterTypeCollect.on('end', (collected, reason) => {
    channelTracker.removeCollector(message.channel.id)
    if (reason == 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
    else if (reason !== 'user') return message.channel.sendMessage(reason);
  })


}

const Discord = require('discord.js')
const fileOps = require('../../util/fileOps.js')
const config = require('../../config.json')
const channelTracker = require('../../util/channelTracker.js')
const validFilterTypes = ['Title', 'Description', 'Summary', 'Author', 'Tag']

exports.add = function(message, rssName, role) {
  var guildRss = require(`../../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  if (!rssList[rssName].filters) rssList[rssName].filters = {};
  if (role && !rssList[rssName].filters.roleSubscriptions) rssList[rssName].filters.roleSubscriptions = {};
  if (role && !rssList[rssName].filters.roleSubscriptions[role.id]) {
    rssList[rssName].filters.roleSubscriptions[role.id] = {
      roleName: role.name,
      filters: {}
    }
  }

  // Select the correct filter list, whether if it's for a role's filtered subscription or feed filters
  // Null role = not adding a filter for a role
  var filterList = (role) ? rssList[rssName].filters.roleSubscriptions[role.id].filters : rssList[rssName].filters

  // Generate the filter categories here
  var msg = `\`\`\`Markdown\n# Chosen Feed: ${rssList[rssName].link}\n# List of available filters to add\`\`\`\`\`\`Markdown\n`
  for (let filterType in validFilterTypes) {
    msg += `\n[Filter Category]: ${validFilterTypes[filterType]}\n`;
  }

  message.channel.sendMessage(msg + '```\n**Type the filter category for which you would like you add a filter to, or type exit to cancel.**').catch(err => console.log(`Promise Warning: filterAdd 1: ${err}`))

  const filter = m => m.author.id == message.author.id
  const filterTypeCollect = message.channel.createCollector(filter,{time:240000})
  channelTracker.addCollector(message.channel.id)

  filterTypeCollect.on('message', function (filterType) {
    // Select the filter category here

    if (filterType.content === 'exit') return filterTypeCollect.stop('Feed Filter Addition menu closed.');
    var chosenFilterType = '';

    // Validate the chosen filter category
    for (let a in validFilterTypes) {
      if (filterType.content.toLowerCase() == validFilterTypes[a].toLowerCase()) chosenFilterType = validFilterTypes[a];
    }

    if (!chosenFilterType) return message.channel.sendMessage('That is not a valid filter category. Try again.').catch(err => console.log(`Promise Warning: filterAdd 2: ${err}`));

    // Valid filter category was chosen
    filterTypeCollect.stop();
    message.channel.sendMessage(`Type the filter word/phrase you would like to add in the category \`${chosenFilterType}\` by typing it, type multiple word/phrases on different lines to add more than one, or type \`{exit}\` to cancel. The filter will be applied as **case insensitive** to feeds.`)
    .then(m => {
      const filterCollect = message.channel.createCollector(filter,{time:240000})
      channelTracker.addCollector(message.channel.id)

      filterCollect.on('message', function(chosenFilter) {
        if (chosenFilter.content === '{exit}') return filterCollect.stop('Feed Filter Addition menu closed.');
        // Global subs are always deleted if filtered subs are added
        if (!role) delete rssList[rssName].roleSubscriptions;
        if (!filterList[chosenFilterType]) filterList[chosenFilterType] = [];
        message.channel.sendMessage(`Updating filters...`)
        .then(editing => {
          filterCollect.stop()

          // Assume the chosen filters are an array
          var addList = chosenFilter.content.trim().split('\n')
          var addedList = ''
          var invalidItems = ''
          for (var item in addList) {
            // Account for invalid items, AKA duplicate filters.
            if (!filterList[chosenFilterType].includes(addList[item].trim()) && addList[item].trim()) {
              filterList[chosenFilterType].push(addList[item].trim());
              addedList += `\n${addList[item].trim()}`;
            }
            else invalidItems += `\n${addList[item]}`;
          }

          fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`)

          if (!role) {
            console.log(`RSS Filters: (${message.guild.id}, ${message.guild.name}) => New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${rssList[rssName].link}.`);
            let msg = `The following filter(s) have been successfully added for the filter category \`${chosenFilterType}\`:\`\`\`\n\n${addedList}\`\`\``;
            if (invalidItems) msg += `\n\nThe following filter(s) could not be added because they already exist:\n\`\`\`\n\n${invalidItems}\`\`\``;
            editing.edit(`${msg}\n\nYou may test your filters via \`${config.botSettings.prefix}rsstest\` and see what feeds pass through.`).catch(err => console.log(`Promise Warning: filterAdd 4a: ${err}`));
          }
          else {
            console.log(`RSS Roles: (${message.guild.id}, ${message.guild.name}) => Role (${role.id}, ${role.name}) => New filter(s) [${addedList.trim().split('\n')}] added to '${chosenFilterType}' for ${rssList[rssName].link}.`);
            let msg = `Subscription updated for role \`${role.name}\`. The following filter(s) have been successfully added for the filter category \`${chosenFilterType}\`:\`\`\`\n\n${addedList}\`\`\``;
            if (invalidItems) msg += `\n\nThe following filter(s) could not be added because they already exist:\n\`\`\`\n\n${invalidItems}\`\`\``;
            editing.edit(`${msg}\n\nYou may test your filters via \`${config.botSettings.prefix}rsstest\` and see what feeds will mention the role`).catch(err => console.log(`Promise Warning: filterAdd 4b: ${err}`));
          }

        })
        .catch(err => console.log(`Promise Warning: filterAdd 4: ${err}`));
      });
      filterCollect.on('end', (collected, reason) => {
        channelTracker.removeCollector(message.channel.id)
        if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') return message.channel.sendMessage(reason);
      });
    })
    .catch(err => console.log(`Promise Warning: filterAdd 3: ${err}`));
  })

  filterTypeCollect.on('end', (collected, reason) => {
    channelTracker.removeCollector(message.channel.id)
    if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
    else if (reason !== 'user') return message.channel.sendMessage(reason);
  })
}

exports.remove = function(message, rssName, role) {
  var guildRss = require(`../../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  // Select the correct filter list, whether if it's for a role's filtered subscription or feed filters
  // Null role = not adding a filter for a role
  var filterList = (role) ? rssList[rssName].filters.roleSubscriptions[role.id].filters : rssList[rssName].filters
  if (!filterList || typeof filterList !== 'object') return message.channel.sendMessage(`There are no filters to remove for ${rssList[rssName].link}.`).catch(err => `Promise Warning: filterRemove 1: ${err}`);

  var isEmptyFilter = true

  // Find any existing filter category objects
  if (rssList[rssName].filters && typeof rssList[rssName].filters == 'object') {
    for (let prop in rssList[rssName].filters) if (prop !== 'roleSubscriptions') isEmptyFilter = false;
  }

  if (!role && isEmptyFilter) return message.channel.sendMessage(`There are no filters to remove for ${rssList[rssName].link}.`).catch(err => `Promise Warning: filterRemove 2: ${err}`);

  var msg = new Discord.RichEmbed()
  .setColor(config.botSettings.menuColor)
  .setDescription(`**Feed Title:** ${rssList[rssName].title}\n**Feed Link:** ${rssList[rssName].link}\n\nBelow are the filter categories with their words/phrases under each. Type the filter category for which you would like you remove a filter from, or type exit to cancel.\n_____`)
  .setAuthor(`List of Assigned Filters`)

  for (let filterCategory in filterList)  {
    let value = ''
    if (filterCategory !== 'roleSubscriptions') {
      for (let filter in filterList[filterCategory]) value += `${filterList[filterCategory][filter]}\n`;
    }
    msg.addField(filterCategory, value, true)
  }

  message.channel.sendEmbed(msg)
  .then(m => {
    const filter = m => m.author.id == message.author.id
    const filterTypeCollect = message.channel.createCollector(filter,{time:240000})
    channelTracker.addCollector(message.channel.id)

    filterTypeCollect.on('message', function(filterType) {
      // Select filter category here
      if (filterType.content === 'exit') return filterTypeCollect.stop('Feed Filter Removal menu closed.');
      var chosenFilterType = ''

      // Cross reference with valid filter types and see if valid
      for (let a in validFilterTypes) {
        if (filterType.content.toLowerCase() == validFilterTypes[a].toLowerCase()) chosenFilterType = validFilterTypes[a];
      }

      if (!chosenFilterType) return message.channel.sendMessage('That is not a valid filter category. Try again.').catch(err => console.log(`Promise Warning: filterRemove 5: ${err}`));

      // Valid filter category has been selected.
      filterTypeCollect.stop();
      message.channel.sendMessage(`Confirm the filter word/phrase you would like to remove in the category \`${chosenFilterType}\` by typing one or multiple word/phrases separated by new lines (case sensitive).`).catch(err => console.log(`Promise Warning: filterRemove 6: ${err}`));

      const filterCollect = message.channel.createCollector(filter,{time:240000});
      channelTracker.addCollector(message.channel.id)

      filterCollect.on('message', function(chosenFilter) {
        // Select the word/phrase filter here from that filter category
        var validFilter = false
        var validIndexes = []
        var removeList = chosenFilter.content.trim().split('\n')
        var invalidItems = ''

        for (var item in removeList) {
          let valid = false;
          for (var filterIndex in filterList[chosenFilterType]) {
            if (filterList[chosenFilterType][filterIndex] == removeList[item]) {
              valid = true;
              // Initialize as empty array if valid item found
              if (typeof validFilter !== 'object') validFilter = [];
              // Store the valid filter's information for removal
              validFilter.push({filter: removeList[item], index: filterIndex});
            }
          }
          // Invalid items are ones that do not exist
          if (!valid && removeList[item]) invalidItems += `\n${removeList[item]}`;
        }

        if (chosenFilter.content === 'exit') return filterCollect.stop('Feed Filter Removal menu closed.');
        else if (!validFilter) return message.channel.sendMessage(`That is not a valid filter to remove from \`${chosenFilterType}\`. Try again.`).catch(err => console.log(`Promise Warning: filterRemove 7: ${err}`));

        message.channel.sendMessage(`Removing filter ${chosenFilter.content} from category ${chosenFilterType}...`)
        .then(editing => {
          filterCollect.stop()
          var deletedList = ''
          // Delet the filters stored from before from highest index to lowest
          for (var i = validFilter.length - 1; i >= 0; i--) {
            deletedList += `\n${validFilter[i].filter}`;
            filterList[chosenFilterType].splice(validFilter[i].index, 1);
            if (filterList[chosenFilterType].length === 0) delete filterList[chosenFilterType];
          }

          // Check after removal if there are any empty objects
          if (role && filterList.size() === 0) delete rssList[rssName].filters.roleSubscriptions[role.id];
          if (role && rssList[rssName].filters.roleSubscriptions.size() === 0) delete rssList[rssName].filters.roleSubscriptions;
          if (rssList[rssName].filters.size() === 0) delete rssList[rssName].filters;

          fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`)

          if (!role) {
            console.log(`RSS Filters: (${message.guild.id}, ${message.guild.name}) => Filter(s) [${deletedList.trim().split('\n')}] removed from '${chosenFilterType}' for ${rssList[rssName].link}.`);
            let msg = `The following filter(s) have been successfully removed from the filter category \`${chosenFilterType}\`:\`\`\`\n\n${deletedList}\`\`\``;
            if (invalidItems) msg += `\n\nThe following filter(s) were unable to be deleted because they do not exist:\n\`\`\`\n\n${invalidItems}\`\`\``;
            editing.edit(msg).catch(err =>console.log(`Promise Warning: filterRemove 8a: ${err}`));
          }
          else {
            console.log(`RSS Roles: (${message.guild.id}, ${message.guild.name}) => Role (${role.id}, ${role.name}) => Filter(s) [${deletedList.trim().split('\n')}] removed from '${chosenFilterType}' for ${rssList[rssName].link}.`);
            let msg = `Subscription updated for role \`${role.name}\`. The following filter(s) have been successfully removed from the filter category \`${chosenFilterType}\`:\`\`\`\n\n${deletedList}\`\`\``;
            if (invalidItems) msg += `\n\nThe following filters were unable to be removed because they do not exist:\n\`\`\`\n\n${invalidItems}\`\`\``;
            editing.edit(msg).catch(err => console.log(`Promise Warning: filterRemove 8b: ${err}`));
          }

        })
        .catch(err => console.log(`Promise Warning: filterRemove 8: ${err}`));
      })
      filterCollect.on('end', (collected, reason) => {
        channelTracker.removeCollector(message.channel.id)
        if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') return message.channel.sendMessage(reason);
      });
    })
    filterTypeCollect.on('end', (collected, reason) => {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') return message.channel.sendMessage(reason);
    });
  })
  .catch(err => console.log(`Promise Warning: filterRemove 3: ${err}`))
}

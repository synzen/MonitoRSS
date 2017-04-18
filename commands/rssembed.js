const fileOps = require('../util/fileOps.js')
const config = require('../config.json')
const getIndex = require('./util/printFeeds.js')
const channelTracker = require('../util/channelTracker.js')
const embedProperties = [['Color', 'The sidebar color of the embed\nThis MUST be an integer color between 0 and 16777215. See https://www.shodor.org/stella2java/rgbint.html', 'color'],
                      ['Author Title', 'Title of the embed\nAccepts tags.', 'authorTitle'],
                      ['Author Avatar URL', 'The avatar picture to the left of author title.\nThis MUST be a link to an image. If an Author Title is not specified, the Author Avatar URL will not be shown.', 'authorAvatarURL'],
                      ['Image URL', 'The main image on the bottom of the embed.\nThis MUST be a link to an image, OR an {imageX} tag.', 'imageURL'],
                      ['Thumbnail URL', 'The picture on the right hand side of the embed\nThis MUST be a link to an image, OR an {imageX} tag.', 'thumbnailURL'],
                      ['Message', 'Main message of the embed\nAcceps tags.', 'message'],
                      ['Footer Text', 'The bottom-most text\nAccepts tags.', 'footerText'],
                      ['URL', 'A link that clicking on the title will lead to.\nThis MUST be a link. By default this is set to the feed\'s url', 'url']]

const imageFields = ['thumbnailURL', 'authorAvatarURL', 'imageURL']
const currentGuilds = require('../util/guildStorage.js').currentGuilds

// Check valid image URLs via extensions
function isValidImg(input) {
  if (input.startsWith('http')) {
    var matches = input.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
    if (matches) return true;
    else return false;
  }
  else if (input.startsWith('{image')) {
    if (input.length !== 8) return false;
    let imgNum = parseInt(input.substr(6, 1), 10);
    if (!isNaN(imgNum) && imgNum > 0) return true;
    else return false;
  }
  else return false;
}

module.exports = function(bot, message, command) {

  getIndex(bot, message, command, function(rssName) {

    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources

    // Reset and disable entire embed
    function resetAll(collector) {
      return message.channel.sendMessage(`Resetting and disabling embed...`)
      .then(function(resetting) {
        collector.stop()
        delete rssList[rssName].embedMessage
        if (rssList[rssName].message === '{empty}') delete rssList[rssName].message; // An empty message is not allowed if there is no embed
        fileOps.updateFile(message.guild.id, guildRss)
        console.log(`Embed Customization: (${message.guild.id}, ${message.guild.name}) => Embed reset for ${rssList[rssName].link}.`)
        resetting.edit('Embed has been disabled, and all properties have been removed.').catch(err => console.log(`Promise Warning: rssEmbed 2a: ${err}`))
      })
      .catch(err => console.log(`Promise Warning: rssEmbed 2: ${err}`));
    }

    // Reset an individual property
    function reset(collector, choice) {
      return message.channel.sendMessage(`Retting property \`${choice}\`...`)
      .then(function(resetting) {
        collector.stop()
        if (!rssList[rssName].embedMessage || !rssList[rssName].embedMessage.properties || !rssList[rssName].embedMessage.properties[choice]) return message.channel.sendMessage('This property has nothing to reset.');
        delete rssList[rssName].embedMessage.properties[choice]
        if (rssList[rssName].embedMessage.properties.size() === 0) {
          delete rssList[rssName].embedMessage;
          if (rssList[rssName].message === '{empty}') delete rssList[rssName].message; // An empty message is not allowed if there is no embed
        }
        fileOps.updateFile(message.guild.id, guildRss)
        console.log(`Embed Customization: (${message.guild.id}, ${message.guild.name}) => Property '${choice}' reset for ${rssList[rssName].link}.`)
        resetting.edit(`Settings updated. The property \`${choice}\` has been reset.`).catch(err => console.log(`Promise Warning: rssEmbed 8a: ${err}`))
      })
      .catch(err => console.log(`Promise Warning: rssEmbed 8: ${err}`))
    }

    // Generate list of all embed properties for user to see
    var embedListMsg = '```Markdown\n'
    for (var prop in embedProperties) {
      embedListMsg += `[${embedProperties[prop][0]}]: ${embedProperties[prop][1]}\n\n`
    }
    embedListMsg += '```'

    // Generate lsit of embed properties currently set
    let currentEmbedProps = '```Markdown\n';
    if (rssList[rssName].embedMessage && rssList[rssName].embedMessage.properties) {
      let propertyList = rssList[rssName].embedMessage.properties;
      for (var property in propertyList) {
        for (var y in embedProperties) {
          if (embedProperties[y][2] == property && propertyList[property]) {
            currentEmbedProps += `[${embedProperties[y][0]}]: ${propertyList[property]}\n`
          }
        }
      }
    }

    if (currentEmbedProps == '```Markdown\n') currentEmbedProps = '```\nNo properties set.\n';

    message.channel.sendMessage(`The current embed properties for ${rssList[rssName].link} are: \n${currentEmbedProps + '```'}\nThe available properties are: ${embedListMsg}\n**Type the embed property (shown in brackets [property]) you want to set/reset**, type \`reset\` to disable and remove all properties, or type **exit** to cancel.`)
    .then(function(m) {
      const filter = m => m.author.id == message.author.id
      const customCollect = message.channel.createCollector(filter,{time:240000})
      channelTracker.addCollector(message.channel.id)

      customCollect.on('message', function (chosenProp) {
        // Select an embed property here
        if (chosenProp.content.toLowerCase() == 'exit') return customCollect.stop('Embed customization menu closed.');

        var choice = '';
        // Reference with valid properties and check if valid
        for (var e in embedProperties) {
          if (chosenProp.content.toLowerCase() == embedProperties[e][0].toLowerCase()) choice = embedProperties[e][2];
        }

        // Delete the properties object to reset embed
        if (chosenProp.content === 'reset') return resetAll(customCollect);
        else if (!choice) return message.channel.sendMessage('That is not a valid property. Try again.').catch(err => console.log(`Promise Warning: rssEmbed 3: ${err}`));

        // property collector
        customCollect.stop();
        message.channel.sendMessage(`Set the property now. To reset the property, type \`reset\`.\n\nRemember that you can use tags \`{title}\`, \`{description}\`, \`{link}\`, and etc. in the correct fields. Regular formatting such as **bold** and etc. is also available. To find other tags, you may first type \`exit\` then use \`${config.botSettings.prefix}rsstest\`.`).catch(err => console.log(`Promise Warning: rssEmbed 4: ${err}`));
        const propertyCollect = message.channel.createCollector(filter, {time: 240000});
        channelTracker.addCollector(message.channel.id);

        propertyCollect.on('message', function (propSetting) {
          // Define the new property here
          var finalChange = propSetting.content
          if (finalChange.toLowerCase() === 'exit') return propertyCollect.stop('Embed customization menu closed.');
          else if (finalChange.toLowerCase() === 'reset') return reset(propertyCollect, choice);
          else if (choice === 'color') {
           if (isNaN(parseInt(finalChange, 10))) return message.channel.sendMessage('The color must be an **number**. See https://www.shodor.org/stella2java/rgbint.html. Try again.').catch(err => console.log(`Promise Warning: rssEmbed 5a: ${err}`));
           else if (finalChange < 0 || finalChange > '16777215') return message.channel.sendMessage('The color must be a number between 0 and 16777215. Try again.').catch(err => console.log(`Promise Warning: rssEmbed 5b: ${err}`));
          }
          else if (imageFields.includes(choice) && !isValidImg(finalChange)) return message.channel.sendMessage('URLs must link to actual images or be `{imageX}` tags. Try again.').catch(err => console.log(`Promise Warning: rssEmbed 6: ${err}`));
          else if (choice === 'attachURL' && !finalChange.startsWith('http')) return message.channel.sendMessage('URL option must be a link. Try again.').catch(err => console.log(`Promise Warning: rssEmbed 7: ${err} `));

          message.channel.sendMessage(`Updating embed settings...`)
          .then(function(editing) {
            propertyCollect.stop()

            // Initialize if the embed message does not already exist
            if (!rssList[rssName].embedMessage || !rssList[rssName].embedMessage.properties) {
              rssList[rssName].embedMessage = {
                enabled: 1,
                properties: {}
              }
            }

            rssList[rssName].embedMessage.properties[choice] = finalChange

            console.log(`Embed Customization: (${message.guild.id}, ${message.guild.name}) => Embed updated for ${rssList[rssName].link}. Property '${choice}' set to '${finalChange}'.`)
            fileOps.updateFile(message.guild.id, guildRss)

            return editing.edit(`Settings updated. The property \`${choice}\` has been set to \`\`\`${finalChange}\`\`\`\nYou may use \`${config.botSettings.prefix}rsstest\` to see your new embed format.`).catch(err => console.log(`Promise Warning: rssEmbed 9a: ${err}`));
          })
          .catch(err => console.log(`Promise Warning: rssEmbed 9: ${err}`));
        });
        propertyCollect.on('end', function(collected, reason) {
          channelTracker.removeCollector(message.channel.id)
          if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
          else if (reason !== 'user') return message.channel.sendMessage(reason);
        });

      });
      customCollect.on('end', function(collected, reason) {
        channelTracker.removeCollector(message.channel.id)
        if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') return message.channel.sendMessage(reason);
      });
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send embed customization prompt. (${err})`))
  })

 }

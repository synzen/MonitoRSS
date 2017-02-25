const fileOps = require('../util/updateJSON.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')

module.exports = function (message, rssIndex) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  var embedProperties = [["Color", "The sidebar color of the embed\nThis MUST be an integer color between 0 and 16777215. See https://www.shodor.org/stella2java/rgbint.html", "color"],
                        ["Author Title", "Title of the embed\nAccepts tags.", "authorTitle"],
                        ["Author Avatar URL", "The avatar picture to the left of author title.\nThis MUST be a link to an image. If an Author Title is not specified, the Author Avatar URL will not be shown.", "authorAvatarURL"],
                        ['Image URL', 'The main image on the bottom of the embed.\nThis MUST be a link to an image, OR an {imageX} tag.', 'imageURL'],
                        ["Thumbnail URL", "The picture on the right hand side of the embed\nThis MUST be a link to an image, OR an {imageX} tag.", "thumbnailURL"],
                        ["Message", "Main message of the embed\nAcceps tags.", "message"],
                        ["Footer Text", "The bottom-most text\nAccepts tags.", "footerText"],
                        ["URL", "A link that clicking on the title will lead to.\nThis MUST be a link. By default this is set to the feed's url", "url"]]

  var imageFields = ['thumbnailURL', 'authorAvatarURL', 'imageURL']

  function isValidImg (input) {
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

  var embedListMsg = "```Markdown\n"
  for (var prop in embedProperties) {
    embedListMsg += `[${embedProperties[prop][0]}]: ${embedProperties[prop][1]}\n\n`
  }
  embedListMsg += "```"


  if (!rssList[rssIndex].embedMessage || !rssList[rssIndex].embedMessage.properties)
    rssList[rssIndex].embedMessage = {
      enabled: 0,
      properties: {}
    };

  let currentEmbedProps = "```Markdown\n";
  if (rssList[rssIndex].embedMessage && rssList[rssIndex].embedMessage.properties) {
    let propertyList = rssList[rssIndex].embedMessage.properties;
    for (var property in propertyList) {
      for (var y in embedProperties)
        if (embedProperties[y][2] == property && propertyList[property] != null && propertyList[property] != "") {
          currentEmbedProps += `[${embedProperties[y][0]}]: ${propertyList[property]}\n`
        }
    }
  }

  if (currentEmbedProps == "```Markdown\n") currentEmbedProps = "```\nNo properties set.\n";

  message.channel.sendMessage(`The current embed properties for ${rssList[rssIndex].link} are: \n${currentEmbedProps + "```"}\nThe available properties are: ${embedListMsg}\n**Type the embed property (shown in brackets [property]) you want to set/reset**, type \`reset\` to disable and remove all properties, or type **exit** to cancel.`).catch(err => console.log(`Promise Warning: rssEmbed 1: ${err}`))

  const filter = m => m.author.id == message.author.id
  const customCollect = message.channel.createCollector(filter,{time:240000})
  channelTracker.addCollector(message.channel.id)

  customCollect.on('message', function (chosenProp) {
    if (chosenProp.content.toLowerCase() == "exit") return customCollect.stop("RSS customization menu closed.");

    var choice = '';
    for (var e in embedProperties) {
      if (chosenProp.content.toLowerCase() == embedProperties[e][0].toLowerCase()) choice = embedProperties[e][2];
    }

    if (chosenProp.content == "reset") {
      message.channel.sendMessage(`Resetting and disabling embed...`)
      .then (resetting => {
        customCollect.stop();
        delete rssList[rssIndex].embedMessage;
        fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`);
        console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Embed reset for ${rssList[rssIndex].link}.`);
        resetting.edit("Embed has been disabled, and all properties have been removed.").catch(err => console.log(`Promise Warning: rssEmbed 2a: ${err}`))
      })
      .catch(err => console.log(`Promise Warning: rssEmbed 2: ${err}`));
    }
    else if (!choice) message.channel.sendMessage("That is not a valid property.").catch(err => console.log(`Promise Warning: rssEmbed 3: ${err}`));
    else {
      //property collector
      customCollect.stop()
      message.channel.sendMessage(`Set the property now. To reset the property, type \`reset\`.\n\nRemember that you can use tags \`{title}\`, \`{description}\`, \`{link}\`, and etc. in the correct fields. Regular formatting such as **bold** and etc. is also available. To find other tags, you may first type \`exit\` then use \`${config.botSettings.prefix}rsstest\`.`).catch(err => console.log(`Promise Warning: rssEmbed 4: ${err}`));
      const propertyCollect = message.channel.createCollector(filter, {time: 240000});
      channelTracker.addCollector(message.channel.id)

      propertyCollect.on('message', function (propSetting) {
        if (propSetting.content.toLowerCase() == "exit") return propertyCollect.stop("RSS customization menu closed.");
        else if (choice == "color" && propSetting.content !== "reset") {
         if (isNaN(parseInt(propSetting.content,10))) return message.channel.sendMessage("The color must be an **number**. See https://www.shodor.org/stella2java/rgbint.html. Try again.").catch(err => console.log(`Promise Warning: rssEmbed 5a: ${err}`));
         else if (propSetting.content < 0 || propSetting.content > '16777215') return message.channel.sendMessage('The color must be a number between 0 and 16777215. Try again.').catch(err => console.log(`Promise Warning: rssEmbed 5b: ${err}`));
       }
        else if (imageFields.includes(choice) && propSetting.content !== "reset" && !isValidImg(propSetting.content)) return message.channel.sendMessage("URLs must link to actual images or be `{imageX}` tags. Try again.").catch(err => console.log(`Promise Warning: rssEmbed 6: ${err}`));
        else if (choice == "attachURL" && propSetting.content !== "reset" && !propSetting.content.startsWith("http")) {return message.channel.sendMessage("URL option must be a link. Try again.").catch(err => console.log(`Promise Warning: rssEmbed 7: ${err} `));}
        else message.channel.sendMessage(`Updating embed settings...`)
        .then(editing => {
          let finalChange = propSetting.content;
          if (choice == "color") finalChange = parseInt(propSetting.content,10);
          propertyCollect.stop();

          if (!rssList[rssIndex].embedMessage || !rssList[rssIndex].embedMessage.properties)
            rssList[rssIndex].embedMessage = {
              enabled: 0,
              properties: {}
            };

          if (isNaN(parseInt(finalChange,10)) && finalChange.toLowerCase() == "reset") delete rssList[rssIndex].embedMessage.properties[choice];
          else rssList[rssIndex].embedMessage.properties[choice] = finalChange;

          rssList[rssIndex].embedMessage.enabled = 1;
          console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Embed updated for ${rssList[rssIndex].link}.`);
          fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`);
          if (isNaN(parseInt(finalChange,10)) && finalChange.toLowerCase() == "reset") {
            return editing.edit(`Settings updated. The property \`${choice}\` has been reset.`).catch(err => console.log(`Promise Warning: rssEmbed 8a: ${err}`));
          }
          else {
            return editing.edit(`Settings updated. The property \`${choice}\` has been set to \`\`\`${finalChange}\`\`\`\nYou may use \`${config.botSettings.prefix}rsstest\` to see your new embed format.`).catch(err => console.log(`Promise Warning: rssEmbed 8b: ${err}`));
          }
        })
        .catch(err => console.log(`Promise Warning: rssEmbed 8: ${err}`));
      });
      propertyCollect.on('end', (collected, reason) => {
        channelTracker.removeCollector(message.channel.id)
        if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== "user") return message.channel.sendMessage(reason);
      });
      }
    });
    customCollect.on('end', (collected, reason) => {
      channelTracker.removeCollector(message.channel.id)
      if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== "user") return message.channel.sendMessage(reason);
    });
 }

const fileOps = require('../util/fileOps.js')
const config = require('../config.json')
const chooseFeed = require('./util/chooseFeed.js')
const channelTracker = require('../util/channelTracker.js')
// embedProperties where [0] = property name, [1] = property description, [2] = internal reference to property
const embedProperties = [['Color', 'The sidebar color of the embed\nThis MUST be an integer color between 0 and 16777215. See https://www.shodor.org/stella2java/rgbint.html', 'color'],
                      ['Author Title', 'Title of the embed\nAccepts placeholders', 'authorTitle'],
                      ['Author URL', 'Clicking on the Atuhor Title will lead to this URL.\nThis MUST be a link.', 'authorURL'],
                      ['Author Avatar URL', 'The avatar picture to the left of author title.\nThis MUST be a link to an image. If an Author Title is not specified, the Author Avatar URL will not be shown.', 'authorAvatarURL'],
                      ['Title', 'Subtitle of the embed\nAccepts placeholders', 'title'],
                      ['Image URL', 'The main image on the bottom of the embed.\nThis MUST be a link to an image, OR an {imageX} placeholder', 'imageURL'],
                      ['Thumbnail URL', 'The picture on the right hand side of the embed\nThis MUST be a link to an image, OR an {imageX} placeholder', 'thumbnailURL'],
                      ['Message', 'Main message of the embed\nAccepts placeholders', 'message'],
                      ['Footer Text', 'The bottom-most text\nAccepts placeholders', 'footerText'],
                      ['URL', 'Clicking on the Title/Thumbnail will lead to this URL.\nThis MUST be a link. By default this is set to the feed\'s url', 'url']]

const imageFields = ['thumbnailURL', 'authorAvatarURL', 'imageURL']
const currentGuilds = require('../util/storage.js').currentGuilds

// Check valid image URLs via extensions
function isValidImg (input) {
  if (input.startsWith('http')) {
    const matches = input.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
    if (matches) return true
    else return false
  } else if (input.startsWith('{')) {
    const results = input.startsWith('{image') ? input.search(/^{image[1-9](\|\|(.+))*}$/) : input.search(/^{(description|image|title):image[1-5](\|\|(.+))*}$/)
    if (results === -1) return false
    const arr = input.split('||')
    if (arr.length === 1) return true
    let valid = true
    for (var x in arr) {
      if (!valid) continue
      const term = x === '0' ? `${arr[x]}}` : x === (arr.length - 1).toString() ? `{${arr[x]}` : `{${arr[x]}}`
      if (!isValidImg(term)) valid = false
    }
    return valid
  } else return false
}

module.exports = function (bot, message, command) {
  chooseFeed(bot, message, command, function (rssName, msgHandler) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources

    // Reset and disable entire embed
    function resetAll (collector) {
      return message.channel.send(`Resetting and disabling embed...`)
      .then(function (resetting) {
        collector.stop('endMenu')
        delete rssList[rssName].embedMessage
        if (rssList[rssName].message === '{empty}') delete rssList[rssName].message // An empty message is not allowed if there is no embed
        fileOps.updateFile(message.guild.id, guildRss)
        console.log(`Embed Customization: (${message.guild.id}, ${message.guild.name}) => Embed reset for ${rssList[rssName].link}.`)
        resetting.edit(`Embed has been disabled, and all properties have been removed for <${rssList[rssName].link}>.`).catch(err => console.log(`Promise Warning: rssEmbed 2a: ${err}`))
      }).catch(err => {
        collector.stop()
        console.log(`Promise Warning: rssEmbed 2: ${err}`)
      })
    }

    // Reset an individual property
    function reset (collector, choice) {
      return message.channel.send(`Resetting property \`${choice}\`...`)
      .then(function (resetting) {
        collector.stop()
        if (!rssList[rssName].embedMessage || !rssList[rssName].embedMessage.properties || !rssList[rssName].embedMessage.properties[choice]) return resetting.edit('This property has nothing to reset.').catch(err => console.log(`Promise Warning: rssEmbed 2b: ${err}`))
        delete rssList[rssName].embedMessage.properties[choice]
        if (rssList[rssName].embedMessage.properties.size() === 0) {
          delete rssList[rssName].embedMessage
          if (rssList[rssName].message === '{empty}') delete rssList[rssName].message // An empty message is not allowed if there is no embed
        }
        fileOps.updateFile(message.guild.id, guildRss)
        console.log(`Embed Customization: (${message.guild.id}, ${message.guild.name}) => Property '${choice}' reset for ${rssList[rssName].link}.`)
        resetting.edit(`Settings updated. The property \`${choice}\` has been reset for <${rssList[rssName].link}>.`).catch(err => console.log(`Promise Warning: rssEmbed 8a: ${err}`))
      }).catch(err => {
        console.log(`Promise Warning: rssEmbed 8: ${err}`)
        collector.stop()
      })
    }

    // Generate list of all embed properties for user to see
    var embedListMsg = '```Markdown\n'
    for (var prop in embedProperties) {
      embedListMsg += `[${embedProperties[prop][0]}]: ${embedProperties[prop][1]}\n\n`
    }
    embedListMsg += '```'

    // Generate lsit of embed properties currently set
    let currentEmbedProps = '```Markdown\n'
    if (rssList[rssName].embedMessage && rssList[rssName].embedMessage.properties) {
      let propertyList = rssList[rssName].embedMessage.properties
      for (var property in propertyList) {
        for (var y in embedProperties) {
          if ((embedProperties[y][2] === property) && propertyList[property]) {
            currentEmbedProps += `[${embedProperties[y][0]}]: ${propertyList[property]}\n`
          }
        }
      }
    }

    if (currentEmbedProps === '```Markdown\n') currentEmbedProps = '```\nNo properties set.\n'

    message.channel.send(`The current embed properties for ${rssList[rssName].link} are: \n${currentEmbedProps + '```'}\nThe available properties are: ${embedListMsg}\n**Type the embed property (shown in brackets [property]) you want to set/reset**, type \`reset\` to disable and remove all properties, or type \`exit\` to cancel.`)
    .then(function (m) {
      msgHandler.add(m)
      const filter = m => m.author.id === message.author.id
      const customCollect = message.channel.createMessageCollector(filter, {time: 240000})
      channelTracker.add(message.channel.id)

      customCollect.on('collect', function (chosenProp) {
        msgHandler.add(chosenProp)
        // Select an embed property here
        if (chosenProp.content.toLowerCase() === 'exit') return customCollect.stop('Embed customization menu closed.')

        var choice = ''
        // Reference with valid properties and check if valid
        for (var e in embedProperties) {
          if (chosenProp.content.toLowerCase() === embedProperties[e][0].toLowerCase()) choice = embedProperties[e][2]
        }

        // Delete the properties object to reset embed
        if (chosenProp.content === 'reset') return resetAll(customCollect)
        else if (!choice) return message.channel.send('That is not a valid property. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: rssEmbed 3: ${err}`))

        // property collector
        customCollect.stop()
        message.channel.send(`Set the property now. To reset the property, type \`reset\`.\n\nRemember that you can use placeholders \`{title}\`, \`{description}\`, \`{link}\`, and etc. in the correct fields. Regular formatting such as **bold** and etc. is also available. To find other placeholders, you may first type \`exit\` then use \`${config.botSettings.prefix}rsstest\`.`)
        .then(function (msgPrompt) {
          msgHandler.add(msgPrompt)
          const propertyCollect = message.channel.createMessageCollector(filter, {time: 240000})
          channelTracker.add(message.channel.id)

          propertyCollect.on('collect', function (propSetting) {
            msgHandler.add(propSetting)
            // Define the new property here
            var finalChange = propSetting.content.trim()
            if (finalChange.toLowerCase() === 'exit') return propertyCollect.stop('Embed customization menu closed.')
            else if (finalChange.toLowerCase() === 'reset') return reset(propertyCollect, choice)
            else if (choice === 'color') {
              if (isNaN(parseInt(finalChange, 10))) return message.channel.send('The color must be an **number**. See https://www.shodor.org/stella2java/rgbint.html. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: rssEmbed 5a: ${err}`))
              else if (parseInt(finalChange, 10) < 0 || parseInt(finalChange, 10) > 16777215) return message.channel.send('The color must be a number between 0 and 16777215. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: rssEmbed 5b: ${err}`))
            } else if (imageFields.includes(choice) && !isValidImg(finalChange)) return message.channel.send('URLs must link to actual images or be `{imageX}` placeholders. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: rssEmbed 6: ${err}`))
            else if (choice === 'attachURL' && !finalChange.startsWith('http')) return message.channel.send('URL option must be a link. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: rssEmbed 7: ${err} `))

            message.channel.send(`Updating embed settings...`)
            .then(function (editing) {
              propertyCollect.stop()

              if (typeof rssList[rssName].embedMessage !== 'object' || typeof rssList[rssName].embedMessage.properties !== 'object') rssList[rssName].embedMessage = { properties: {} }

              rssList[rssName].embedMessage.properties[choice] = finalChange

              console.log(`Embed Customization: (${message.guild.id}, ${message.guild.name}) => Embed updated for ${rssList[rssName].link}. Property '${choice}' set to '${finalChange}'.`)
              fileOps.updateFile(message.guild.id, guildRss)

              return editing.edit(`Settings updated for <${rssList[rssName].link}>. The property \`${choice}\` has been set to \`\`\`${finalChange}\`\`\`\nYou may use \`${config.botSettings.prefix}rsstest\` to see your new embed format.`).catch(err => console.log(`Promise Warning: rssEmbed 9a: ${err}`))
            }).catch(err => { console.log(`Promise Warning: rssEmbed 9: ${err}`); channelTracker.remove(message.channel.id) })
          })
          propertyCollect.on('end', function (collected, reason) {
            channelTracker.remove(message.channel.id)
            msgHandler.deleteAll(message.channel)
            if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
            else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
          })
        }).catch(err => { console.log(`Promise Warning: rssEmbed 4: ${err}`); channelTracker.remove(message.channel.id) })
      })
      customCollect.on('end', function (collected, reason) {
        channelTracker.remove(message.channel.id)
        if (reason === 'user') return // Do not execute msgHandler.deleteAll if is user, since this means menu series proceeded to the next step and has not ended, unless reason is 'endMenu'
        if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
        else if (reason !== 'user' && reason !== 'endMenu') message.channel.send(reason).then(m => m.delete(6000))
        msgHandler.deleteAll(message.channel)
      })
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send embed customization prompt. (${err})`))
  })
}

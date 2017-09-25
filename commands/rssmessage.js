const fileOps = require('../util/fileOps.js')
const chooseFeed = require('./util/chooseFeed.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/storage.js').currentGuilds

function isNotEmpty (obj) {
  for (var x in obj) return true
}

module.exports = function (bot, message, command) {
  chooseFeed(bot, message, command, function (rssName, msgHandler) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources

    const currentMsg = rssList[rssName].message ? '```Markdown\n' + rssList[rssName].message + '```' : '```Markdown\nNone has been set. Currently using default message below:\n\n``````\n' + config.feedSettings.defaultMessage + '```'

    message.channel.send(`The current message for ${rssList[rssName].link} is: \n${currentMsg}\nType your new customized message now, type \`reset\` to use the default message, or type \`exit\` to cancel. \n\nRemember that you can use the placeholders \`{title}\`, \`{description}\`, \`{link}\`, and etc. \`{empty}\` will create an empty message, but only if an embed is used. Regular formatting such as **bold** and etc. is also available. To find other placeholders, type \`exit\` then \`${config.botSettings.prefix}rsstest\`.\n\n`)
    .then(function (msgPrompt) {
      msgHandler.add(msgPrompt)
      channelTracker.add(message.channel.id)
      const filter = m => m.author.id === message.author.id
      const customCollect = message.channel.createMessageCollector(filter, {time: 240000})

      customCollect.on('collect', function (m) {
        msgHandler.add(m)
        if (m.content.toLowerCase() === 'exit') return customCollect.stop('Message customization menu closed.')
        // Reset custom message
        else if (m.content.toLowerCase() === 'reset') {
          message.channel.send(`Resetting message...`).then(function (resetMsg) {
            customCollect.stop()
            delete rssList[rssName].message
            fileOps.updateFile(message.guild.id, guildRss)
            console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Message reset for ${rssList[rssName].link}.`)
            return resetMsg.edit(`Message reset and using default message:\n \`\`\`Markdown\n${config.feedSettings.defaultMessage}\`\`\` \nfor feed ${rssList[rssName].link}`).catch(err => console.log(`Promise Warning: rssMessage 2a: ${err}`))
          }).catch(err => console.log(`Promise Warning: rssMessage 2: ${err}`))
        } else if (m.content === '{empty}' && (typeof rssList[rssName].embedMessage !== 'object' || typeof rssList[rssName].embedMessage.properties !== 'object' || Array.isArray(rssList[rssName].embedMessage.properties) || !isNotEmpty(rssList[rssName].embedMessage.properties))) return message.channel.send('You cannot have an empty message if there is no embed used for this feed. Try again.') // Allow empty messages only if embed is enabled
        else { // Set new message
          message.channel.send(`Updating message...`).then(function (editing) {
            customCollect.stop()
            rssList[rssName].message = m.content
            fileOps.updateFile(message.guild.id, guildRss)
            console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => New message recorded for ${rssList[rssName].link}.`)
            editing.edit(`Message recorded:\n \`\`\`Markdown\n${m.content}\`\`\` \nfor feed <${rssList[rssName].link}>. You may use \`${config.botSettings.prefix}rsstest\` to see your new message format.`).catch(err => console.log(`Promise Warning: rssMessage 3a: ${err}`))
          }).catch(err => console.log(`Promise Warning: rssMessage 3: ${err}`))
        }
      })

      customCollect.on('end', function (collected, reason) {
        channelTracker.remove(message.channel.id)
        msgHandler.deleteAll(message.channel)
        if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
        else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
      })
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send custom message prompt (${err}).`))
  })
}

const fileOps = require('../util/fileOps.js')
const chooseFeed = require('./util/chooseFeed.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const webhooks = storage.webhooks
const webhookAccessors = storage.webhookAccessors
const MsgHandler = require('../util/MsgHandler.js')

module.exports = function (bot, message, command) {
  if (config.advanced.restrictWebhooks === true && !webhookAccessors.ids.includes(message.author.id)) {
    console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => User "${message.author.username}" attempted to access webhooks as an unauthorized user`)
    return message.channel.send(`You do not have access to webhook use.`).catch(e => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Unable to send unauthorized message: `, e.message || e))
  }
  if (!message.guild.me.permissionsIn(message.channel).has('MANAGE_WEBHOOKS')) return message.channel.send(`I do not have permission to use webhooks in this channel. Please provide me Manage Webhooks permission.`).catch(e => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Unable to send MANAGE_WEBHOOKS permission error message: `, e.message || e))

  chooseFeed(bot, message, command, function (rssName, msgHandler) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources
    const existingWebhook = rssList[rssName].webhook

    message.channel.fetchWebhooks().then(function (hooks) {
      message.channel.send(`${typeof existingWebhook === 'string' ? 'An existing webhook was found (' + existingWebhook + '). Your new setting will overwrite this. ' : ''}Type the name of the webhook in this channel you wish to use (case sensitive).`)
      .then(function (prompt) {
        msgHandler.add(prompt)

        const filter = m => m.author.id === message.author.id
        const collector = message.channel.createMessageCollector(filter, {time: 240000})
        channelTracker.add(message.channel.id)



        collector.on('collect', function (m) {
          msgHandler.add(m)
          const webhookName = m.content
          if (webhookName.toLowerCase() === 'exit') return collector.stop(`Webhook setting menu closed.`)
          const hook = hooks.find('name', m.content)
          if (!hook) return message.channel.send(`No such webhook found for this channel. Try again.`).then(m => msgHandler.add(m)).catch(e => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => usewebhook 1: `, e.message || e))
          rssList[rssName].webhook = hook.name

          webhooks[rssName] = hook
          webhooks[rssName].guild = {id: m.guild.id, name: m.guild.name}

          fileOps.updateFile(m.guild.id, guildRss)
          webhooks[rssName].send(`I am now connected to ${bot.user}!`).catch(e => console.log(`Commands warning: (${message.guild.id}, ${message.guild.name}) => usewebhook 2: `, e.message || e))
          msgHandler.deleteAll(message.channel)


        })

        collector.on('end', function (collected, reason) {
          channelTracker.remove(message.channel.id)
          if (reason === 'user') return // Do not execute msgHandler.deleteAll if is user, since this means menu series proceeded to the next step and has not ended
          if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
          else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
          msgHandler.deleteAll(message.channel)
        })
      })
    }).catch(function (e) {
      msgHandler.deleteAll(message.channel)
      message.channel.send(`Error: Unable to fetch webhooks for this channel. `, e.message ? e.message : '')
      console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Unable to fetch webhooks for channel for webhook setting: `, e.message || e)
    })

  })

}

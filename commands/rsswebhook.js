const fileOps = require('../util/fileOps.js')
const chooseFeed = require('./util/chooseFeed.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const webhookAccessors = storage.webhookAccessors

module.exports = function (bot, message, command) {
  if (config.advanced.restrictWebhooks === true && !webhookAccessors.ids.includes(message.guild.id)) {
    console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => User "${message.author.username}" attempted to access webhooks as an unauthorized user`)
    return message.channel.send(`This server does not have access to webhook use.`).catch(e => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Unable to send unauthorized message: `, e.message || e))
  }
  if (!message.guild.me.permissionsIn(message.channel).has('MANAGE_WEBHOOKS')) return message.channel.send(`I must have Manage Webhooks permission in this channel in order to work.`).catch(e => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Unable to send MANAGE_WEBHOOKS permission error message: `, e.message || e))

  chooseFeed(bot, message, command, function (rssName, msgHandler) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources
    const existingWebhook = rssList[rssName].webhook

    message.channel.fetchWebhooks().then(function (hooks) {
      message.channel.send(`
${typeof existingWebhook === 'object' ? 'An existing webhook was found (' + existingWebhook.name + '). You may type {remove} to disconnect the existing webhook, or continue and your new setting will overwrite the existing one.\n\n' : ''}
Type the name of the webhook in this channel you wish to use (case sensitive), or type exit to cancel.\n\n
To use a different name or avatar url of the webhook when articles are sent for this particular feed, add parameters \`--name="my new name here"\` or \`--avatar="http://website.com/image.jpg"\``)
      .then(function (prompt) {
        msgHandler.add(prompt)

        const filter = m => m.author.id === message.author.id
        const collector = message.channel.createMessageCollector(filter, {time: 240000})
        channelTracker.add(message.channel.id)

        collector.on('collect', function (m) {
          msgHandler.add(m)
          const webhookName = m.content
          if (webhookName.toLowerCase() === 'exit') return collector.stop(`Webhook setting menu closed.`)
          if (webhookName === '{remove}') {
            collector.stop()
            if (typeof existingWebhook !== 'object') {
              msgHandler.deleteAll(message.channel)
              return message.channel.send(`There is no webhook assigned to this feed.`).catch(e => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rsswebhook 1a: `, e.message || e))
            } else {
              let name = rssList[rssName].webhook.name
              delete rssList[rssName].webhook
              message.channel.send(`Successfully removed webhook ${name} from the feed <${rssList[rssName].link}>.`).catch(e => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rsswebhook 1b: `, e.message || e))
            }
          } else {
            const nameRegex = /--name="(((?!(--name|--avatar)).)*)"/
            const avatarRegex = /--avatar="(((?!(--name|--avatar)).)*)"/

            const hookName = m.content.replace(nameRegex, '').replace(avatarRegex, '').trim()
            const hook = hooks.find('name', hookName)
            if (!hook) return message.channel.send(`No such webhook named "${hookName}" found for this channel. Try again, or type exit to cancel.`).then(m => msgHandler.add(m)).catch(e => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rsswebhook 2a: `, e.message || e))

            const customNameSrch = m.content.match(nameRegex)
            const customAvatarSrch = m.content.match(avatarRegex)

            collector.stop()
            rssList[rssName].webhook = {
              id: hook.id
            }

            if (customNameSrch) rssList[rssName].webhook.name = customNameSrch[1]
            if (customAvatarSrch) rssList[rssName].webhook.avatar = customAvatarSrch[1]
            hook.send(`I am now connected to ${bot.user}, and will send feed articles for <${rssList[rssName].link}>!`, {username: customNameSrch ? customNameSrch[1] : null, avatarURL: customAvatarSrch ? customAvatarSrch[1] : null}).catch(e => console.log(`Commands warning: (${message.guild.id}, ${message.guild.name}) => rsswebhook 2b: `, e.message || e))
          }
          msgHandler.deleteAll(message.channel)
          fileOps.updateFile(m.guild.id, guildRss)
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

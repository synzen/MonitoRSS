const config = require('../config.json')
const translator = require('../rss/translator/translate.js')
const storage = require('./storage.js')
const deletedFeeds = storage.deletedFeeds
const currentGuilds = storage.currentGuilds
const debugFeeds = require('../util/debugFeeds').list
const log = require('./logger.js')

module.exports = (bot, article, callback, isTestMessage) => {
  if (config._skipMessages === true) return log.general.info(`Inhibiting article sending due to skipMessages`)
  let channel = bot.channels.get(article.discordChannelId)
  const rssName = article.rssName
  const guildRss = currentGuilds.get(channel.guild.id)
  const rssList = guildRss.sources
  const source = rssList[rssName]
  let channelType = 'textChannel'

  if (!source) return log.general.error(`Unable to send an article due to missing source ${rssName}`, channel.guild, channel)

  if (typeof source.webhook === 'object' && storage.webhookServers.includes(channel.guild.id)) {
    if (!channel.guild.me.permissionsIn(channel).has('MANAGE_WEBHOOKS')) return body()
    channel.fetchWebhooks().then(hooks => {
      const hook = hooks.get(source.webhook.id)
      if (!hook) return body()
      const guildId = channel.guild.id
      const guildName = channel.guild.name
      channel = hook
      channel.guild = {id: guildId, name: guildName}
      channel.name = source.webhook.name ? source.webhook.name : undefined
      channel.avatar = source.webhook.avatar ? source.webhook.avatar : undefined
      channelType = 'webhook'
      body()
    }).catch(err => {
      log.general.warning(`Cannot fetch webhooks for webhook initialization to send message`, channel, err)
      body()
    })
  } else body()

  function body () {
    // Sometimes feeds get deleted mid-retrieval cycle, thus check for empty rssList and if the feed itself was deleted
    if (!rssList || Object.keys(rssList).length === 0) return log.general.warning(`No sources for guild, skipping Discord message sending`, channel)
    if (deletedFeeds.includes(rssName)) return log.general.warning(`Feed (rssName ${rssName}, link: ${source.link}) was deleted during cycle, skipping Discord message sending`, channel)

    let attempts = 1

    // const successLog = (isTestMessage) ? `RSS Test Delivery: (${channel.guild.id}, ${channel.guild.name}) => Sent test message for: ${rssList[rssName].link} in channel (${channel.id}, ${channel.name})` : `RSS Delivery: (${channel.guild.id}, ${channel.guild.name}) => Sent message: ${article.link} in channel (${channel.id}, ${channel.name})`
    // const failLog = (isTestMessage) ? `RSS Test Delivery Failure: (${channel.guild.id}, ${channel.guild.name}) => channel (${channel.id}, ${channel.name}) for article ${article.link}. ` : `RSS Delivery Failure: (${channel.guild.id}, ${channel.guild.name}) => channel (${channel.id}, ${channel.name}) for article ${article.link}. `
    const message = translator(guildRss, rssName, article, isTestMessage)

    if (!message) {
      if (config.logging.showUnfiltered === true) log.general.info(`'${article.link ? article.link : article.title}' did not pass filters and was not sent`, channel)
      return callback()
    }

    function sendTestDetails () {
      channel.send(message.testDetails, channelType === 'textChannel' ? {split: {prepend: '```md\n', append: '```'}} : {split: {prepend: '```md\n', append: '```'}, username: channel.name, avatarURL: channel.avatar})
      .then(m => sendMain())
      .catch(err => {
        if (attempts === 4) return callback(err)
        attempts++
        setTimeout(sendTestDetails, 500)
      })
    }

    function sendCombinedMsg () {
      channel.send(message.textMsg, channelType === 'textChannel' ? message.embedMsg : {username: channel.name, avatarURL: channel.avatar, embeds: [message.embedMsg]})
      .then(m => {
        // console.log(successLog)
        if (debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Message combo has been translated and has been sent (TITLE: ${article.title})`)
        return callback()
      })
      .catch(err => {
        if (attempts === 4) {
          if (debugFeeds.includes(rssName)) log.debug.error(`${rssName}: Message combo has been translated but could not be sent (TITLE: ${article.title})`, err)
          return callback(err)
        }
        attempts++
        setTimeout(sendCombinedMsg, 500)
      })
    }

    function sendTxtMsg () {
      channel.send(message.textMsg, {username: channel.name, avatarURL: channel.avatar})
      .then(m => {
        // console.log(successLog)
        if (debugFeeds.includes(rssName)) log.debug.info(`DEBUG ${rssName}: Message has been translated and has been sent (TITLE: ${article.title}).`)
        return callback()
      })
      .catch(err => {
        if (attempts === 4) {
          if (debugFeeds.includes(rssName)) log.debug.error(`DEBUG ${rssName}: Message has been translated but could not be sent (TITLE: ${article.title})`, err)
          return callback(err)
        }
        attempts++
        setTimeout(sendTxtMsg, 500)
      })
    }

    function sendMain () { // Main Message: If it contains both an embed and text, or only an embed.
      if (message.embedMsg) {
        if (message.textMsg.length > 1950) { // Discord has a character limit of 2000
          log.general.warning(`Feed article could not be sent for ${rssName} due to character count >1950. Message is:\n\n${message.textMsg}`, channel)
          message.textMsg = `Error: Feed Article could not be sent for *${article.link}* due to character count >1950.`
        }
        sendCombinedMsg()
      } else { // Main Message: If it only contains a text message
        if (message.textMsg.length > 1950) {
          log.general.warning(`Feed article could not be sent for ${rssName} due to character count >1950. Message is:\n\n${message.textMsg}`, channel)
          message.textMsg = `Error: Feed Article could not be sent for *${article.link}* due to character count >1950.`
        } else if (message.textMsg.length === 0) {
          message.textMsg = `Unable to send empty message for feed article *${article.link}*.`
        }
        sendTxtMsg()
      }
    }

    // For test messages only. It will send the test details first, then the Main Message (above).
    if (isTestMessage) sendTestDetails()
    else sendMain()
  }
}

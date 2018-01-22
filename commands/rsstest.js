const getRandomArticle = require('../rss/getArticle.js')
const chooseFeed = require('./util/chooseFeed.js')
const sendToDiscord = require('../util/sendToDiscord.js')
const currentGuilds = require('../util/storage.js').currentGuilds

module.exports = function (bot, message, command) {
  let simple = !!(message.content.split(' ').length > 1 && message.content.split(' ')[1] === 'simple')

  chooseFeed(bot, message, command, function (rssName, msgHandler) {
    const guildRss = currentGuilds.get(message.guild.id)

    message.channel.send(`Grabbing a random feed article...`)
    .then(function (grabMsg) {
      getRandomArticle(guildRss, rssName, false, function (err, article) {
        if (err) {
          let channelErrMsg = ''
          switch (err.type) {
            case 'failedLink':
              channelErrMsg = 'Reached fail limit. Please use `rssrefresh` to try to validate and refresh feed'
              break
            case 'request':
              channelErrMsg = 'Unable to connect to feed link'
              break
            case 'feedparser':
              channelErrMsg = 'Invalid feed'
              break
            case 'database':
              channelErrMsg = 'Internal database error. Please try again'
              break
            case 'deleted':
              channelErrMsg = 'Feed missing from database'
              break
            case 'empty':
              channelErrMsg = 'No existing articles'
              break
            default:
              channelErrMsg = 'No reason available'
          }
          console.log(`RSS Warning: Unable to send test article for feed ${err.feed.link}. `, err.content.message || err.content) // Reserve err.content for console logs, which are more verbose
          msgHandler.deleteAll(message.channel)
          return grabMsg.edit(`Unable to grab random feed article. Reason: ${channelErrMsg}.`).catch(err => console.log(`Commands Warning: rsstest 1: `, err.message || err))
        }
        article.rssName = rssName
        article.discordChannelId = message.channel.id
        msgHandler.add(grabMsg)

        sendToDiscord(bot, article, function (err) {
          if (err) {
            console.log(err)
            message.channel.send(`Failed to send test article. \`\`\`${err.message}\`\`\``).catch(err => console.log(`Commands Warning: rsstest 2: `, err.message || err))
          }
          msgHandler.deleteAll(message.channel)
        }, simple ? null : grabMsg) // Last parameter indicating a test message
      })
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could initiate random feed grab for test (${err.message || err})`))
  })
}

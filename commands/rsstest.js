const getRandomArticle = require('../rss/getArticle.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const FeedSelector = require('../structs/FeedSelector.js')
const log = require('../util/logger.js')
const ArticleMessage = require('../structs/ArticleMessage.js')

module.exports = (bot, message, command) => {
  let simple = !!(message.content.split(' ').length > 1 && message.content.split(' ')[1] === 'simple')

  new FeedSelector(message, null, { command: command }).send(null, async (err, data, msgHandler) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { rssName } = data

      const guildRss = currentGuilds.get(message.guild.id)

      const grabMsg = await message.channel.send(`Grabbing a random feed article...`)
      getRandomArticle(guildRss, rssName, false, (err, article) => {
        if (err) {
          let channelErrMsg = ''
          switch (err.type) {
            case 'failedLink':
              channelErrMsg = 'Reached fail limit. Use `rssrefresh` to try to validate and refresh feed'
              break
            case 'request':
              channelErrMsg = 'Unable to connect to feed link'
              break
            case 'feedparser':
              channelErrMsg = 'Invalid feed'
              break
            case 'database':
              channelErrMsg = 'Internal database error. Try again'
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
          log.command.warning(`Unable to send test article for feed ${err.feed.link}`, message.guild, err)
          msgHandler.deleteAll(message.channel)
          return grabMsg.edit(`Unable to grab random feed article for <${err.feed.link}>. (${channelErrMsg})`).catch(err => log.command.warning(`rsstest 1: `, message.guild, err))
        }
        article.rssName = rssName
        article.discordChannelId = message.channel.id
        msgHandler.add(grabMsg)
        new ArticleMessage(article, !simple, true).send(err => {
          if (err) {
            log.command.warning(`Failed to deliver test article ${article.link}`, message.guild, err)
            message.channel.send(`Failed to send test article. \`\`\`${err.message}\`\`\``).catch(err => log.command.warning(`rsstest 2`, message.guild, err))
          }
          msgHandler.deleteAll(message.channel)
        })
      })
    } catch (err) {
      log.command.warning(`Could initiate random feed grab for test:`, message.guild)
    }
  })
}

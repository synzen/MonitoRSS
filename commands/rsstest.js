const getRandomArticle = require('../rss/getArticle.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')

module.exports = async (bot, message, command) => {
  const simple = MenuUtils.extractArgsAfterCommand(message.content).includes('simple')
  try {
    const feedSelector = new FeedSelector(message, null, { command: command })
    // const dataArr = await feedSelector
    const data = await new MenuUtils.MenuSeries(message, [feedSelector]).start()
    if (!data) return
    const { rssName } = data
    const guildRss = currentGuilds.get(message.guild.id)
    const grabMsg = await message.channel.send(`Grabbing a random feed article...`)
    const [ article ] = await getRandomArticle(guildRss, rssName, false)
    article.rssName = rssName
    article.discordChannelId = message.channel.id
    const queue = new ArticleMessageQueue()
    await queue.send(article, !simple, true)
    queue.sendDelayed()
    await grabMsg.delete()
  } catch (err) {
    log.command.warning(`rsstest`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsstest 1', message.guild, err))
  }
}

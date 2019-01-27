const getRandomArticle = require('../rss/getArticle.js')
const dbOps = require('../util/dbOps.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const config = require('../config.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')

module.exports = async (bot, message, command) => {
  const simple = MenuUtils.extractArgsAfterCommand(message.content).includes('simple')
  try {
    const guildRss = await dbOps.guildRss.get(message.guild.id)
    const feedSelector = new FeedSelector(message, null, { command: command }, guildRss)
    const data = await new MenuUtils.MenuSeries(message, [feedSelector]).start()
    if (!data) return
    const { rssName } = data
    const source = guildRss.sources[rssName]
    const grabMsg = await message.channel.send(`Grabbing a random feed article...`)
    const [ article ] = await getRandomArticle(guildRss, rssName, false)
    article._delivery = {
      rssName,
      channelId: message.channel.id,
      dateSettings: {
        timezone: guildRss.timezone,
        format: guildRss.dateFormat,
        language: guildRss.dateLanguage
      }
    }
    if (config._vip && source.webhook && !(await dbOps.vips.isVipServer(message.guild.id))) {
      log.command.warning('Illegal webhook detected for non-vip user', message.guild, message.author)
      delete guildRss.sources[rssName].webhook
    }
    article._delivery.source = guildRss.sources[rssName]

    const queue = new ArticleMessageQueue()
    await queue.send(article, !simple, true)
    queue.sendDelayed()
    await grabMsg.delete()
  } catch (err) {
    log.command.warning(`rsstest`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsstest 1', message.guild, err))
  }
}

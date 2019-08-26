const config = require('../config.js')
const log = require('../util/logger.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const dbOpsVips = require('../util/db/vips.js')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message, command) => {
  const simple = MenuUtils.extractArgsAfterCommand(message.content).includes('simple')
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const guildLocale = guildRss ? guildRss.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feedSelector = new FeedSelector(message, null, { command: command }, guildRss)
    const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale }).start()
    if (!data) return
    const { rssName } = data
    const source = guildRss.sources[rssName]
    const failedLinkResults = dbOpsFailedLinks.get(source.link)
    if (failedLinkResults && failedLinkResults.failed) {
      return await message.channel.send(translate('commands.rsstest.failed'))
    }
    const grabMsg = await message.channel.send(translate('commands.rsstest.grabbingRandom'))
    const article = await FeedFetcher.fetchRandomArticle(source.link)
    if (!article) {
      return await message.channel.send(translate('commands.rsstest.noArticles'))
    }
    article._delivery = {
      rssName,
      channelId: message.channel.id,
      dateSettings: {
        timezone: guildRss.timezone,
        format: guildRss.dateFormat,
        language: guildRss.dateLanguage
      }
    }
    if (config._vip && source.webhook && !(await dbOpsVips.isVipServer(message.guild.id))) {
      log.command.warning('Illegal webhook detected for non-vip user', message.guild, message.author)
      delete guildRss.sources[rssName].webhook
    }
    article._delivery.source = source

    const queue = new ArticleMessageQueue()
    await queue.enqueue(article, !simple, true)
    await queue.send(bot)
    await grabMsg.delete()
  } catch (err) {
    log.command.warning(`rsstest`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsstest 1', message.guild, err))
  }
}

const config = require('../config.js')
const log = require('../util/logger.js')
const dbOpsVips = require('../util/db/vips.js')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')

module.exports = async (bot, message, command) => {
  const simple = MenuUtils.extractArgsAfterCommand(message.content).includes('simple')
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const feeds = profile ? await profile.getFeeds() : []
    const guildLocale = profile ? profile.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feedSelector = new FeedSelector(message, null, { command: command }, feeds)
    const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale }).start()
    if (!data) {
      return
    }
    const { feed } = data
    const failedLinkResults = dbOpsFailedLinks.get(feed.url)
    if (failedLinkResults && failedLinkResults.failed) {
      return await message.channel.send(translate('commands.rsstest.failed'))
    }
    const grabMsg = await message.channel.send(translate('commands.rsstest.grabbingRandom'))
    const article = await FeedFetcher.fetchRandomArticle(feed.url)
    if (!article) {
      return await message.channel.send(translate('commands.rsstest.noArticles'))
    }
    article._delivery = {
      rssName: feed.id,
      source: {
        ...feed.toObject(),
        dateSettings: {
          timezone: profile.timezone,
          format: profile.dateFormat,
          language: profile.dateLanguage
        }
      }
    }
    if (config._vip && profile.webhook && !(await dbOpsVips.isVipServer(message.guild.id))) {
      log.command.warning('Illegal webhook detected for non-vip user', message.guild, message.author)
      profile.webhook = undefined
      await profile.save()
    }

    const queue = new ArticleMessageQueue()
    await queue.enqueue(article, !simple, true)
    await queue.send(bot)
    await grabMsg.delete()
  } catch (err) {
    log.command.warning(`rsstest`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsstest 1', message.guild, err))
  }
}

const log = require('../util/logger.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailCounter = require('../structs/db/FailCounter.js')
const FeedData = require('../structs/db/FeedData.js')
const Supporter = require('../structs/db/Supporter.js')

module.exports = async (bot, message, command) => {
  const simple = MenuUtils.extractArgsAfterCommand(message.content).includes('simple')
  try {
    const profile = await Profile.get(message.guild.id)
    const feeds = await FeedData.getManyBy('guild', message.guild.id)

    const guildLocale = profile ? profile.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feedSelector = new FeedSelector(message, null, { command: command }, feeds)
    const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale }).start()
    if (!data) {
      return
    }
    const { feed } = data
    if (await FailCounter.hasFailed(feed.url)) {
      return await message.channel.send(translate('commands.test.failed'))
    }
    const grabMsg = await message.channel.send(translate('commands.test.grabbingRandom'))
    const article = await FeedFetcher.fetchRandomArticle(feed.url)
    if (!article) {
      return await message.channel.send(translate('commands.test.noArticles'))
    }
    article._feed = feed.toJSON()
    if (Supporter.enabled && profile.webhook && !(await Supporter.hasValidGuild(message.guild.id))) {
      log.command.warning('Illegal webhook detected for non-vip user', message.guild, message.author)
      profile.webhook = undefined
      await profile.save()
    }

    const queue = new ArticleMessageQueue(bot)
    await queue.enqueue(article, !simple, true)
    await queue.send()
    await grabMsg.delete()
  } catch (err) {
    log.command.warning(`rsstest`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsstest 1', message.guild, err))
  }
}

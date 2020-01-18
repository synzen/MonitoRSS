const log = require('../util/logger.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailCounter = require('../structs/db/FailCounter.js')
const Feed = require('../structs/db/Feed.js')
const Format = require('../structs/db/Format.js')
const Subscriber = require('../structs/db/Subscriber.js')
const Supporter = require('../structs/db/Supporter.js')
const FilteredFormat = require('../structs/db/FilteredFormat.js')

module.exports = async (bot, message, command) => {
  const simple = MenuUtils.extractArgsAfterCommand(message.content).includes('simple')
  try {
    const profile = await Profile.get(message.guild.id)
    const feeds = await Feed.getManyBy('guild', message.guild.id)

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
    const [ format, subscribers, filteredFormats ] = await Promise.all([
      Format.getBy('feed', feed._id),
      Subscriber.getManyBy('feed', feed._id),
      FilteredFormat.getManyBy('feed', feed._id)
    ])
    const grabMsg = await message.channel.send(translate('commands.test.grabbingRandom'))
    const article = await FeedFetcher.fetchRandomArticle(feed.url)
    if (!article) {
      return await message.channel.send(translate('commands.test.noArticles'))
    }
    article._delivery = {
      rssName: feed._id,
      source: {
        ...feed.toJSON(),
        format: format ? format.toJSON() : undefined,
        filteredFormats: filteredFormats.map(f => f.toJSON()),
        subscribers: subscribers.map(s => s.toJSON()),
        dateSettings: profile
          ? {
            timezone: profile.timezone,
            format: profile.dateFormat,
            language: profile.dateLanguage
          }
          : {}
      }
    }
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

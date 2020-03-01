const FeedSelector = require('../structs/FeedSelector.js')
const Article = require('../structs/Article.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailRecord = require('../structs/db/FailRecord.js')
const FeedData = require('../structs/FeedData.js')
const Supporter = require('../structs/db/Supporter.js')

module.exports = async (message, command) => {
  const simple = MenuUtils.extractArgsAfterCommand(message.content).includes('simple')
  const profile = await Profile.get(message.guild.id)
  const feedDatas = await FeedData.getManyBy('guild', message.guild.id)
  const feeds = feedDatas.map(data => data.feed)
  const guildLocale = profile ? profile.locale : undefined
  const translate = Translator.createLocaleTranslator(guildLocale)
  const feedSelector = new FeedSelector(message, null, { command: command }, feeds)
  const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale }).start()
  if (!data) {
    return
  }
  // This is the feed data
  const { feed } = data
  if (await FailRecord.hasFailed(feed.url)) {
    return message.channel.send(translate('commands.test.failed'))
  }
  const grabMsg = await message.channel.send(translate('commands.test.grabbingRandom'))
  const article = await FeedFetcher.fetchRandomArticle(feed.url)
  if (!article) {
    return message.channel.send(translate('commands.test.noArticles'))
  }
  article._feed = feedDatas.find(data => data.feed._id === feed._id).toJSON()
  if (Supporter.enabled && profile.webhook && !(await Supporter.hasValidGuild(message.guild.id))) {
    profile.webhook = undefined
    await profile.save()
  }

  if (!simple) {
    const parsedArticle = new Article(article, feed, profile || {})
    const testText = parsedArticle.createTestText()
    await message.channel.send(testText, {
      split: {
        prepend: '```md\n',
        append: '```'
      }
    })
  }

  const queue = new ArticleMessageQueue(message.client)
  await queue.enqueue(article, true)
  await queue.send()
  await grabMsg.delete()
}

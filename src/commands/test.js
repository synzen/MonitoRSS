const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const Article = require('../structs/Article.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const ArticleTestMessage = require('../structs/ArticleTestMessage.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailRecord = require('../structs/db/FailRecord.js')
const FeedData = require('../structs/FeedData.js')
const runWithFeedGuild = require('./prompts/runner/run.js')
const getConfig = require('../config.js').get

module.exports = async (message) => {
  const split = message.content.split(' ')
  const simple = split.includes('simple')
  const latest = split.includes('latest')
  const profile = await Profile.get(message.guild.id)
  const translate = Translator.createProfileTranslator(profile)
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const data = await runWithFeedGuild(selectFeedNode, message)
  const { selectedFeed: feed } = data
  if (!feed) {
    return
  }
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  if (await FailRecord.hasFailed(feed.url)) {
    return message.channel.send(translate('commands.test.failed', {
      prefix
    }))
  }
  const grabMsg = await message.channel.send(translate('commands.test.grabbingRandom'))
  const article = latest ? await FeedFetcher.fetchLatestArticle(feed.url) : await FeedFetcher.fetchRandomArticle(feed.url)
  if (!article) {
    const string = latest ? translate('commands.test.noValidLatest') : translate('commands.test.noArticles')
    return message.channel.send(string)
  }
  const feedData = await FeedData.ofFeed(feed)

  if (!simple) {
    const parsedArticle = new Article(article, feedData)
    const testText = parsedArticle.createTestText()
    await message.channel.send(testText, {
      split: {
        prepend: '```md\n',
        append: '```'
      }
    })
  }

  const articleMessage = new ArticleTestMessage(message.client, article, feedData)
  articleMessage.feed.channel = message.channel.id

  await articleMessage.send()
  await grabMsg.delete()
}

const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const Article = require('../structs/Article.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const ArticleMessage = require('../structs/ArticleMessage.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailRecord = require('../structs/db/FailRecord.js')
const NewArticle = require('../structs/NewArticle.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message, command) => {
  const simple = message.content.endsWith('simple')
  const profile = await Profile.get(message.guild.id)
  const translate = Translator.createProfileTranslator(profile)
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const data = await runWithFeedGuild(selectFeedNode, message)
  const { selectedFeed: feed } = data
  if (!feed) {
    return
  }
  if (await FailRecord.hasFailed(feed.url)) {
    return message.channel.send(translate('commands.test.failed'))
  }
  const grabMsg = await message.channel.send(translate('commands.test.grabbingRandom'))
  const article = await FeedFetcher.fetchRandomArticle(feed.url)
  if (!article) {
    return message.channel.send(translate('commands.test.noArticles'))
  }
  const formatted = await (new NewArticle(article, feed)).formatWithFeedData()
  formatted._feed.channel = message.channel.id
  if (!simple) {
    const parsedArticle = new Article(article, formatted._feed, profile || {})
    const testText = parsedArticle.createTestText()
    await message.channel.send(testText, {
      split: {
        prepend: '```md\n',
        append: '```'
      }
    })
  }

  const articleMessage = new ArticleMessage(message.client, formatted, true)
  await articleMessage.send()
  await grabMsg.delete()
}

const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const runWithFeedGuild = require('./prompts/runner/runWithFeedsProfile.js')
const Article = require('../structs/Article.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const ArticleMessage = require('../structs/ArticleMessage.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailRecord = require('../structs/db/FailRecord.js')
const FeedData = require('../structs/FeedData.js')
const Supporter = require('../structs/db/Supporter.js')

module.exports = async (message, command) => {
  const simple = message.content.endsWith('simple')
  const profile = await Profile.get(message.guild.id)
  const feedDatas = await FeedData.getManyBy('guild', message.guild.id)
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

  const articleMessage = new ArticleMessage(message.client, article, true)
  await articleMessage.send()
  await grabMsg.delete()
}

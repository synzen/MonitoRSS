const { PromptNode } = require('discord.js-prompts')
const ArticleMessage = require('../structs/ArticleMessage.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const Translator = require('../structs/Translator.js')
const FeedData = require('../structs/FeedData.js')
const createLogger = require('../util/logger/create.js')
const commonPrompts = require('./prompts/common/index.js')
const filterPrompts = require('./prompts/filters/index.js')
const runWithFeedsProfile = require('./prompts/runner/runWithFeedsProfile.js')

module.exports = async (message, command, role) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const selectActionNode = new PromptNode(filterPrompts.selectAction.prompt)

  selectFeedNode.addChild(selectActionNode)

  // Path 1
  const filterAddCategorySelectCondition = data => data.selected === '1'
  const filterAddCategorySelectNode = new PromptNode(commonPrompts.filterAddCategorySelect.prompt, filterAddCategorySelectCondition)
  const filterAddInputNode = new PromptNode(commonPrompts.filterAddInput.prompt)
  const filterAddInputSuccessNode = new PromptNode(commonPrompts.filterAddInputSuccess.prompt)

  filterAddCategorySelectNode.addChild(filterAddInputNode)
  filterAddInputNode.addChild(filterAddInputSuccessNode)

  // Path 2
  const filterRemoveCategorySelectCondition = data => data.selected === '2'
  const filterRemoveCategorySelectNode = new PromptNode(commonPrompts.filterRemoveCategorySelect.prompt, filterRemoveCategorySelectCondition)
  const filterRemoveInputNode = new PromptNode(commonPrompts.filterRemoveInput.prompt)
  const filterRemoveInputSuccessNode = new PromptNode(commonPrompts.filterRemoveInputSuccess.prompt)

  filterRemoveCategorySelectNode.addChild(filterRemoveInputNode)
  filterRemoveInputNode.addChild(filterRemoveInputSuccessNode)

  const removedAllFiltersCondition = data => data.selected === '3'
  const removedAllFiltersNode = new PromptNode(filterPrompts.removedAllFiltersSuccess.prompt, removedAllFiltersCondition)
  const removedAllFiltersSuccessNode = new PromptNode(filterPrompts.removedAllFiltersSuccess.prompt)

  removedAllFiltersNode.addChild(removedAllFiltersSuccessNode)

  const listFiltersCondition = data => data.selected === '4'
  const listFiltersNode = new PromptNode(filterPrompts.listFilters.prompt, listFiltersCondition)

  selectActionNode.setChildren([
    filterAddCategorySelectNode,
    filterRemoveCategorySelectNode,
    removedAllFiltersNode,
    listFiltersNode
  ])

  const { selected, selectedFeed: feed, profile } = await runWithFeedsProfile(selectFeedNode, message)
  const translate = Translator.createProfileTranslator(profile)
  const log = createLogger(message.guild.shard.id, {
    guild: message.guild,
    user: message.author
  })

  if (selected === '5') { // 5 = Send passing article
    const filters = feed.hasRFilters() ? feed.rfilters : feed.filters
    const article = await FeedFetcher.fetchRandomArticle(feed.url, filters)
    if (!article) {
      return message.channel.send(translate('commands.filters.noArticlesPassed'))
    }
    log.info(`Sending filtered article for ${feed.url}`)
    const feedDatas = await FeedData.getManyBy('guild', message.guild.id)
    article._feed = feedDatas.find(data => data.feed._id === feed._id).toJSON()

    const articleMessage = new ArticleMessage(message.client, article, true)
    await articleMessage.send()
  }
}

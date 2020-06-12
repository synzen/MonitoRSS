const { PromptNode } = require('discord.js-prompts')
const FeedFetcher = require('../util/FeedFetcher.js')
const Translator = require('../structs/Translator.js')
const NewArticle = require('../structs/NewArticle.js')
const createLogger = require('../util/logger/create.js')
const commonPrompts = require('./prompts/common/index.js')
const filterPrompts = require('./prompts/filters/index.js')
const runWithFeedsProfile = require('./prompts/runner/run.js')

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
  // No Filters
  const noFiltersToRemoveCondition = data => data.selected === '2' && !data.selectedFeed.hasFilters()
  const noFiltersToRemoveNode = new PromptNode(filterPrompts.listFilters.prompt, noFiltersToRemoveCondition)

  // Has Filters
  const filterRemoveCategorySelectCondition = data => data.selected === '2'
  const filterRemoveCategorySelectNode = new PromptNode(commonPrompts.filterRemoveCategorySelect.prompt, filterRemoveCategorySelectCondition)
  const filterRemoveInputNode = new PromptNode(commonPrompts.filterRemoveInput.prompt)
  const filterRemoveInputSuccessNode = new PromptNode(commonPrompts.filterRemoveInputSuccess.prompt)

  filterRemoveCategorySelectNode.addChild(filterRemoveInputNode)
  filterRemoveInputNode.addChild(filterRemoveInputSuccessNode)

  const removedAllFiltersSuccessCondition = data => data.selected === '3'
  const removedAllFiltersSuccessNode = new PromptNode(filterPrompts.removedAllFiltersSuccess.prompt, removedAllFiltersSuccessCondition)

  const listFiltersCondition = data => data.selected === '4'
  const listFiltersNode = new PromptNode(filterPrompts.listFilters.prompt, listFiltersCondition)

  selectActionNode.setChildren([
    filterAddCategorySelectNode,
    noFiltersToRemoveNode,
    filterRemoveCategorySelectNode,
    removedAllFiltersSuccessNode,
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
    const articleMessage = await (new NewArticle(article, feed)).getArticleMessage(message.client)
    articleMessage.feed.channel = message.channel.id
    await articleMessage.send()
  }
}

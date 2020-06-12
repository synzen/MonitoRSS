const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const mentionFilterPrompts = require('./prompts/mention.filters/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const selectSubscriberNode = new PromptNode(mentionFilterPrompts.selectSubscriber.prompt)
  const selectActionNode = new PromptNode(mentionFilterPrompts.selectAction.prompt)

  // Path 1
  const filterAddCategorySelectCondition = data => data.selected === '1'
  const filterAddCategorySelectNode = new PromptNode(commonPrompts.filterAddCategorySelect.prompt, filterAddCategorySelectCondition)
  const filterAddInputNode = new PromptNode(commonPrompts.filterAddInput.prompt)
  const filterAddInputSuccessNode = new PromptNode(commonPrompts.filterAddInputSuccess.prompt)

  filterAddCategorySelectNode.addChild(filterAddInputNode)
  filterAddInputNode.addChild(filterAddInputSuccessNode)

  // Path 2
  // No filters to remove
  const noFiltersToRemoveCondition = data => data.selected === '2' && !data.selectedSubscriber.hasFilters()
  const noFiltersToRemoveNode = new PromptNode(mentionFilterPrompts.listFilters.prompt, noFiltersToRemoveCondition)

  // Input filter category and remove
  const filterRemoveCategorySelectCondition = data => data.selected === '2' && data.selectedSubscriber.hasFilters()
  const filterRemoveCategorySelectNode = new PromptNode(commonPrompts.filterRemoveCategorySelect.prompt, filterRemoveCategorySelectCondition)
  const filterRemoveInputNode = new PromptNode(commonPrompts.filterRemoveInput.prompt)
  const filterRemoveInputSuccessNode = new PromptNode(commonPrompts.filterRemoveInputSuccess.prompt)

  filterRemoveCategorySelectNode.addChild(filterRemoveInputNode)
  filterRemoveInputNode.addChild(filterRemoveInputSuccessNode)

  // Path 3
  const removeAllFiltersSuccessNodeCondition = data => data.selected === '3'
  const removeAllFiltersSuccessNode = new PromptNode(mentionFilterPrompts.removeAllFiltersSuccess.prompt, removeAllFiltersSuccessNodeCondition)

  const listFiltersNodeCondition = data => data.selected === '4'
  const listFilterNode = new PromptNode(mentionFilterPrompts.listFilters.prompt, listFiltersNodeCondition)

  selectFeedNode.addChild(selectSubscriberNode)
  selectSubscriberNode.addChild(selectActionNode)
  selectActionNode.setChildren([
    filterAddCategorySelectNode,
    noFiltersToRemoveNode,
    filterRemoveCategorySelectNode,
    removeAllFiltersSuccessNode,
    listFilterNode
  ])

  await runWithFeedGuild(selectFeedNode, message)
}

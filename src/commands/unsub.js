const { PromptNode } = require('discord.js-prompts')
const subPrompts = require('./prompts/sub/index.js')
const unsubPrompts = require('./prompts/unsub/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectActionNode = new PromptNode(unsubPrompts.selectAction.prompt)

  const inputRemoveRoleNodeCondition = data => data.selected === '1'
  const inputRemoveRoleNode = new PromptNode(unsubPrompts.inputRemoveRole.prompt, inputRemoveRoleNodeCondition)
  const removeRoleSuccessNode = new PromptNode(unsubPrompts.removeRoleSuccess.prompt)

  inputRemoveRoleNode.addChild(removeRoleSuccessNode)

  const selectFeedNodeCondition = data => data.selected === '2'
  const selectFeedNode = new PromptNode(unsubPrompts.selectFeed.prompt, selectFeedNodeCondition)
  const removeDirectSuccessNode = new PromptNode(unsubPrompts.removeDirectSuccess.prompt)

  selectFeedNode.addChild(removeDirectSuccessNode)

  const removeAllSuccessNodeCondition = data => data.selected === '3'
  const removeAllSuccessNode = new PromptNode(unsubPrompts.removeAllSuccess.prompt, removeAllSuccessNodeCondition)

  const listSubscribedFeedsNodeCondition = data => data.selected === '4'
  const listSubscribedFeedsNode = new PromptNode(subPrompts.listSubscribedFeeds.prompt, listSubscribedFeedsNodeCondition)

  selectActionNode.setChildren([
    inputRemoveRoleNode,
    selectFeedNode,
    removeAllSuccessNode,
    listSubscribedFeedsNode
  ])
  await runWithFeedGuild(selectActionNode, message)
}

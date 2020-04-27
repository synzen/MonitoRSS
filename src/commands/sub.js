const { PromptNode } = require('discord.js-prompts')
const subPrompts = require('./prompts/sub/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectActionNode = new PromptNode(subPrompts.selectAction.prompt)

  const inputRoleNodeCondition = data => data.selected === '1'
  const inputRoleNode = new PromptNode(subPrompts.inputRole.prompt, inputRoleNodeCondition)
  const addRoleSuccess = new PromptNode(subPrompts.addRoleSuccess.prompt)

  inputRoleNode.addChild(addRoleSuccess)

  const selectFeedNodeCondition = data => data.selected === '2'
  const selectFeedNode = new PromptNode(subPrompts.selectFeed.prompt, selectFeedNodeCondition)
  const addDirectResultNode = new PromptNode(subPrompts.addDirectResult.prompt)

  const listSubscribedFeedsNodeCondition = data => data.selected === '3'
  const listSubscribedFeedsNode = new PromptNode(subPrompts.listSubscribedFeeds.prompt, listSubscribedFeedsNodeCondition)

  selectFeedNode.addChild(addDirectResultNode)

  selectActionNode.setChildren([
    inputRoleNode,
    selectFeedNode,
    listSubscribedFeedsNode
  ])

  await runWithFeedGuild(selectActionNode, message)
}

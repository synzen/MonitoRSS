const { PromptNode } = require('discord.js-prompts')
const clonePrompts = require('./prompts/clone/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectSourceFeedNode = new PromptNode(clonePrompts.selectSourceFeed.prompt)
  const selectDestinationFeedsNode = new PromptNode(clonePrompts.selectDestinationFeeds.prompt)
  const selectPropertiesNode = new PromptNode(clonePrompts.selectProperties.prompt)
  const confirmNode = new PromptNode(clonePrompts.confirm.prompt)
  const confirmSuccessNode = new PromptNode(clonePrompts.confirmSuccess.prompt)

  selectSourceFeedNode.addChild(selectDestinationFeedsNode)
  selectDestinationFeedsNode.addChild(selectPropertiesNode)
  selectPropertiesNode.addChild(confirmNode)
  confirmNode.addChild(confirmSuccessNode)

  await runWithFeedGuild(selectSourceFeedNode, message)
}

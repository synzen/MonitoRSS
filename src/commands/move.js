const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const movePrompts = require('./prompts/move/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectMultipleFeedsNode = new PromptNode(commonPrompts.selectMultipleFeeds.prompt)
  const selectDestinationChannelNode = new PromptNode(movePrompts.selectDestinationChannel.prompt)
  const successNode = new PromptNode(movePrompts.success.prompt)

  selectMultipleFeedsNode.addChild(selectDestinationChannelNode)
  selectDestinationChannelNode.addChild(successNode)
  await runWithFeedGuild(selectMultipleFeedsNode, message)
}

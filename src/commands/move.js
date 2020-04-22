const { PromptNode } = require('discord.js-prompts')
const movePrompts = require('./prompts/move/index.js')
const runWithFeedGuild = require('./prompts/runner/runWithFeedsProfile.js')

module.exports = async (message) => {
  const selectSourceFeedsNode = new PromptNode(movePrompts.selectSourceFeeds.prompt)
  const selectDestinationChannelNode = new PromptNode(movePrompts.selectDestinationChannel.prompt)
  const successNode = new PromptNode(movePrompts.success.prompt)

  selectSourceFeedsNode.addChild(selectDestinationChannelNode)
  selectDestinationChannelNode.addChild(successNode)
  await runWithFeedGuild(selectSourceFeedsNode, message)
}

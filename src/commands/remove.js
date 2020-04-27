const { PromptNode } = require('discord.js-prompts')
const removePrompts = require('./prompts/remove/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message, command) => {
  const selectRemoveFeedsNode = new PromptNode(removePrompts.selectRemoveFeeds.prompt)
  const removeSuccessNode = new PromptNode(removePrompts.removeSuccess.prompt)

  selectRemoveFeedsNode.addChild(removeSuccessNode)

  await runWithFeedGuild(selectRemoveFeedsNode, message)
}

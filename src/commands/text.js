const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const messagePrompts = require('./prompts/text/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const setMessageNode = new PromptNode(messagePrompts.setMessage.prompt)
  const successNode = new PromptNode(messagePrompts.success.prompt)

  selectFeedNode.addChild(setMessageNode)
  setMessageNode.addChild(successNode)
  await runWithFeedGuild(selectFeedNode, message)
}

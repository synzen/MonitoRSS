const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const webhookPrompts = require('./prompts/webhook/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const selectWebhookNode = new PromptNode(webhookPrompts.selectWebhook.prompt)
  const removedSuccessNodeCondition = data => data.removed === true
  const removedSuccessNode = new PromptNode(webhookPrompts.removedSuccess.prompt, removedSuccessNodeCondition)

  selectFeedNode.addChild(selectWebhookNode)
  selectWebhookNode.addChild(removedSuccessNode)
  await runWithFeedGuild(selectFeedNode, message)
}

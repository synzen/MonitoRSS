const { PromptNode } = require('discord.js-prompts')
const optionsPrompts = require('./prompts/options/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectOptionNode = new PromptNode(optionsPrompts.selectOption.prompt)
  const selectFeedWithOptionNode = new PromptNode(optionsPrompts.selectFeedWithOption.prompt)
  const successNode = new PromptNode(optionsPrompts.success.prompt)

  selectOptionNode.addChild(selectFeedWithOptionNode)
  selectFeedWithOptionNode.addChild(successNode)
  await runWithFeedGuild(selectOptionNode, message)
}

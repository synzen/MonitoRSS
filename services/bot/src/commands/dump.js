const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const dumpPrompts = require('./prompts/dump/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message, command) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const sendFileNode = new PromptNode(dumpPrompts.sendFile.prompt)

  selectFeedNode.addChild(sendFileNode)

  await runWithFeedGuild(selectFeedNode, message, {
    raw: message.content.split(' ')[1] === 'original'
  })
}

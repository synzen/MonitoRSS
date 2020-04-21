const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const embedPrompts = require('./prompts/embed/index.js')
const runWithFeedGuild = require('./prompts/runner/runWithFeedsProfile.js')

module.exports = async (message) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)

  const selectEmbedNodeCondition = data => !!data.selectedFeed.webhook
  const selectEmbedNode = new PromptNode(embedPrompts.selectEmbed.prompt, selectEmbedNodeCondition)

  const selectPropertiesNodeCondition = data => !data.selectedFeed.webhook
  const selectPropertiesNode = new PromptNode(embedPrompts.selectProperties.prompt, selectPropertiesNodeCondition)

  const resetEmbedSuccessNodeCondition = data => data.reset
  const resetEmbedSuccessNode = new PromptNode(embedPrompts.resetEmbedSuccess.prompt, resetEmbedSuccessNodeCondition)

  const setPropertyNodeCondition = data => data.properties.length > 0
  const setPropertyNode = new PromptNode(embedPrompts.setProperty.prompt, setPropertyNodeCondition)

  const setPropertySuccessNodeCondition = data => data.properties.length === 0
  const setPropertySuccessNode = new PromptNode(embedPrompts.setPropertySuccess.prompt, setPropertySuccessNodeCondition)

  selectFeedNode.setChildren([
    selectEmbedNode,
    selectPropertiesNode
  ])
  selectEmbedNode.addChild(selectPropertiesNode)
  selectPropertiesNode.setChildren([
    resetEmbedSuccessNode,
    setPropertyNode
  ])
  setPropertyNode.setChildren([
    setPropertyNode,
    setPropertySuccessNode
  ])
  await runWithFeedGuild(selectFeedNode, message, {
    targetEmbedIndex: 0
  })
}

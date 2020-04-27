const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const embedPrompts = require('./prompts/embed/index.js')
const fieldPrompts = require('./prompts/embed.fields/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)

  const selectEmbedNodeCondition = data => !!data.selectedFeed.webhook
  const selectEmbedNode = new PromptNode(embedPrompts.selectEmbed.prompt, selectEmbedNodeCondition)

  const selectFieldActionNodeCondition = data => !data.selectedFeed.webhook
  const selectFieldActionNode = new PromptNode(fieldPrompts.selectAction.prompt, selectFieldActionNodeCondition)

  const addFieldNodeCondition = data => data.selected === '1' || data.selected === '2'
  const addFieldNode = new PromptNode(fieldPrompts.addField.prompt, addFieldNodeCondition)
  const addFieldSuccessNode = new PromptNode(fieldPrompts.addFieldSuccess.prompt)

  const addBlankFieldSuccessNodeCondition = data => data.selected === '3' || data.selected === '4'
  const addBlankFieldSuccessNode = new PromptNode(fieldPrompts.addBlankFieldSuccess.prompt, addBlankFieldSuccessNodeCondition)

  const removeFieldNodeCondition = data => data.selected === '5'
  const removeFieldNode = new PromptNode(fieldPrompts.removeField.prompt, removeFieldNodeCondition)
  const removeFieldSucessNode = new PromptNode(fieldPrompts.removeFieldSuccess.prompt)

  selectFeedNode.setChildren([
    selectEmbedNode,
    selectFieldActionNode
  ])
  selectEmbedNode.addChild(selectFieldActionNode)

  selectFieldActionNode.setChildren([
    addFieldNode,
    addBlankFieldSuccessNode,
    removeFieldNode
  ])

  addFieldNode.addChild(addFieldSuccessNode)
  removeFieldNode.addChild(removeFieldSucessNode)
  await runWithFeedGuild(selectFeedNode, message, {
    targetEmbedIndex: 0
  })
}

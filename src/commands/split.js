const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const splitPrompts = require('./prompts/split/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)

  const enableNodeCondition = data => !data.selectedFeed.split
  const enableNode = new PromptNode(splitPrompts.enable.prompt, enableNodeCondition)

  const selectSplitOptionsNodeCondition = data => !!data.selectedFeed.split
  const selectSplitOptionsNode = new PromptNode(splitPrompts.selectSplitOptions.prompt, selectSplitOptionsNodeCondition)

  const inputSplitCharacterNodeCondition = data => data.selected === '1'
  const inputSplitCharacterNode = new PromptNode(splitPrompts.inputSplitCharacter.prompt, inputSplitCharacterNodeCondition)
  const inputSplitCharacterSuccessNode = new PromptNode(splitPrompts.inputSplitCharacterSuccess.prompt)

  const inputPrependCharacterNodeCondition = data => data.selected === '2'
  const inputPrependCharacterNode = new PromptNode(splitPrompts.inputPrependCharacter.prompt, inputPrependCharacterNodeCondition)
  const inputPrependCharacterSuccessNode = new PromptNode(splitPrompts.inputPrependCharacterSuccess.prompt)

  const inputAppendCharacterNodeCondition = data => data.selected === '3'
  const inputAppendCharacterNode = new PromptNode(splitPrompts.inputAppendCharacter.prompt, inputAppendCharacterNodeCondition)
  const inputAppendCharacterSuccessNode = new PromptNode(splitPrompts.inputAppendCharacterSuccess.prompt)

  const inputMaxLengthNodeCondition = data => data.selected === '4'
  const inputMaxLengthNode = new PromptNode(splitPrompts.inputMaxLength.prompt, inputMaxLengthNodeCondition)
  const inputMaxLengthSuccessNode = new PromptNode(splitPrompts.inputMaxLengthSuccess.prompt)

  const disabledSuccessNodeCondition = data => data.selected === '5'
  const disabledSuccessNode = new PromptNode(splitPrompts.disabledSuccess.prompt, disabledSuccessNodeCondition)

  selectFeedNode.setChildren([
    enableNode,
    selectSplitOptionsNode
  ])
  enableNode.addChild(selectSplitOptionsNode)
  selectSplitOptionsNode.setChildren([
    inputSplitCharacterNode,
    inputPrependCharacterNode,
    inputAppendCharacterNode,
    inputMaxLengthNode,
    disabledSuccessNode
  ])
  inputSplitCharacterNode.addChild(inputSplitCharacterSuccessNode)
  inputPrependCharacterNode.addChild(inputPrependCharacterSuccessNode)
  inputAppendCharacterNode.addChild(inputAppendCharacterSuccessNode)
  inputMaxLengthNode.addChild(inputMaxLengthSuccessNode)

  await runWithFeedGuild(selectFeedNode, message)
}

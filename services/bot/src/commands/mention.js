const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const mentionPrompts = require('./prompts/mention/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)

  const selectActionNode = new PromptNode(mentionPrompts.selectAction.prompt)

  const addSubscriberNodeCondition = data => data.selected === '1'
  const addSubscriberNode = new PromptNode(mentionPrompts.addSubscriber.prompt, addSubscriberNodeCondition)
  const addSubscriberSuccessNode = new PromptNode(mentionPrompts.addSubscriberSuccess.prompt)

  const removeSubscriberNodeCondition = data => data.selected === '2'
  const removeSubscriberNode = new PromptNode(mentionPrompts.removeSubscriber.prompt, removeSubscriberNodeCondition)
  const removeSubscriberSuccessNode = new PromptNode(mentionPrompts.removeSubscriberSuccess.prompt)

  const removeAllSubscribersSuccessNodeCondition = data => data.selected === '3'
  const removeAllSubscribersSuccessNode = new PromptNode(mentionPrompts.removeAllSubscribersSuccess.prompt, removeAllSubscribersSuccessNodeCondition)

  const listSubscribersNodeCondition = data => data.selected === '4'
  const listSubscribersNode = new PromptNode(mentionPrompts.listSubscribers.prompt, listSubscribersNodeCondition)

  selectFeedNode.addChild(selectActionNode)
  selectActionNode.setChildren([
    addSubscriberNode,
    removeSubscriberNode,
    removeAllSubscribersSuccessNode,
    listSubscribersNode
  ])

  addSubscriberNode.addChild(addSubscriberSuccessNode)
  removeSubscriberNode.addChild(removeSubscriberSuccessNode)

  await runWithFeedGuild(selectFeedNode, message)
}

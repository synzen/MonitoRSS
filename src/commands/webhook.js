const { PromptNode } = require('discord.js-prompts')
const webhookPrompts = require('./prompts/webhook/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')
const Guild = require('../structs/Guild.js')
const Supporter = require('../structs/db/Supporter.js')

module.exports = async (message) => {
  const guild = new Guild(message.guild.id)
  const supporter = await guild.hasSupporterOrSubscriber()
  if (Supporter.enabled && !supporter) {
    message.channel.send('You must be a patron to add webhooks. See <https://www.patreon.com/monitorss> for more details.')
    return
  }
  const selectFeedNode = new PromptNode(webhookPrompts.selectFeed.prompt)
  const selectWebhookNode = new PromptNode(webhookPrompts.selectWebhook.prompt)
  const removedSuccessNodeCondition = data => data.removed === true
  const removedSuccessNode = new PromptNode(webhookPrompts.removedSuccess.prompt, removedSuccessNodeCondition)

  selectFeedNode.addChild(selectWebhookNode)
  selectWebhookNode.addChild(removedSuccessNode)
  await runWithFeedGuild(selectFeedNode, message)
}

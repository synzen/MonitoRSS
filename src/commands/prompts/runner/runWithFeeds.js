const { DiscordPromptRunner, PromptNode } = require('discord.js-prompts')
const Feed = require('../../../structs/db/Feed.js')
const noFeeds = require('../common/noFeedsFound.js')

/**
 * @param {import('discord-prompts').DiscordPrompt} rootNode
 * @param {import('discord.js').Message} message
 * @param {Object<string, any>} initialData
 */
async function runWithFeeds (rootNode, message, initialData = {}) {
  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const noFeedsFoundCondition = data => data.feeds.length === 0
  const noFeedsNode = new PromptNode(noFeeds.prompt, noFeedsFoundCondition)
  const runner = new DiscordPromptRunner(message.author, {
    feeds,
    ...initialData
  })
  return runner.runArray([
    noFeedsNode,
    rootNode
  ], message.channel)
}

module.exports = runWithFeeds

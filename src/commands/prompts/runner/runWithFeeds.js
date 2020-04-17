const { DiscordPromptRunner } = require('discord.js-prompts')
const Feed = require('../../../structs/db/Feed.js')

/**
 * @param {import('discord-prompts').DiscordPrompt} rootNode
 * @param {import('discord.js').Message} message
 * @param {Object<string, any>} initialData
 */
async function runWithFeeds (rootNode, message, initialData = {}) {
  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const runner = new DiscordPromptRunner(message.author, {
    feeds,
    ...initialData
  })
  return runner.run(rootNode, message.channel)
}

module.exports = runWithFeeds

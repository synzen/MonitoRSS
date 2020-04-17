const { DiscordPromptRunner } = require('discord.js-prompts')

/**
 * @param {import('discord-prompts').DiscordPrompt} rootNode
 * @param {import('discord.js').Message} message
 * @param {Object<string, any>} initialData
 */
async function run (rootNode, message, initialData = {}) {
  const runner = new DiscordPromptRunner(message.author, {
    ...initialData
  })
  return runner.run(rootNode, message.channel)
}

module.exports = run

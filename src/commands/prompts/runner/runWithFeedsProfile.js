const { PromptNode, DiscordPromptRunner } = require('discord.js-prompts')
const Profile = require('../../../structs/db/Profile.js')
const Feed = require('../../../structs/db/Feed.js')
const noFeeds = require('../common/noFeedsFound.js')

/**
 * @param {import('discord-prompts').DiscordPrompt} rootNode
 * @param {import('discord.js').Message} message
 * @param {Object<string, any>} initialData
 */
async function runWithFeedsProfile (rootNode, message, initialData = {}) {
  const { author, channel, guild } = message
  const profile = await Profile.get(guild.id)
  const feeds = await Feed.getManyBy('guild', guild.id)
  const noFeedsFoundCondition = data => data.feeds.length === 0
  const noFeedsNode = new PromptNode(noFeeds.prompt, noFeedsFoundCondition)
  const runner = new DiscordPromptRunner(author, {
    feeds,
    profile,
    ...initialData
  })
  return runner.runArray([
    noFeedsNode,
    rootNode
  ], channel)
}

module.exports = runWithFeedsProfile

const { PromptNode } = require('discord.js-prompts')
const listPrompts = require('./prompts/list/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

/**
 * @param {import('discord.js').Message} message
 */
function getChannelMention (message) {
  return message.mentions.channels.first()
}

/**
 * @param {import('discord.js').Message} message
 */
function getSearchQuery (message) {
  const channelMention = getChannelMention(message)
  const array = message.content.trim().split(' ').filter(s => s)
  if (channelMention) {
    return array.slice(2, array.length).join(' ')
  } else {
    return array.slice(1, array.length).join(' ')
  }
}

module.exports = async (message) => {
  const selectSourceFeedNode = new PromptNode(listPrompts.listFeeds.prompt)

  await runWithFeedGuild(selectSourceFeedNode, message, {
    guildID: message.guild.id,
    channel: getChannelMention(message),
    searchQuery: getSearchQuery(message)
  })
}

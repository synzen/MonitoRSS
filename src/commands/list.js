const { PromptNode } = require('discord.js-prompts')
const listPrompts = require('./prompts/list/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectSourceFeedNode = new PromptNode(listPrompts.listFeeds.prompt)

  await runWithFeedGuild(selectSourceFeedNode, message, {
    guildID: message.guild.id
  })
}

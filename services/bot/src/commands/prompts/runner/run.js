const { PromptNode, DiscordPromptRunner, DiscordChannel, Errors } = require('discord.js-prompts')
const Profile = require('../../../structs/db/Profile.js')
const Feed = require('../../../structs/db/Feed.js')
const Translator = require('../../../structs/Translator.js')
const noFeeds = require('../common/noFeedsFound.js')
const deleteMessages = require('./util/deleteMessages.js')

async function getInitialData (guild) {
  const [profile, feeds] = await Promise.all([
    Profile.get(guild.id),
    Feed.getManyBy('guild', guild.id)
  ])
  return {
    profile,
    feeds
  }
}

/**
 * @param {import('discord-prompts').DiscordPrompt} rootNode
 * @param {import('discord.js').Message} message
 * @param {Object<string, any>} inputData
 */
async function runWithFeedsProfile (rootNode, message, inputData = {}) {
  const { author, channel, guild } = message
  const initialData = {
    ...await getInitialData(guild),
    ...inputData
  }
  const noFeedsNode = new PromptNode(noFeeds.prompt, data => data.feeds.length === 0)
  const runner = new DiscordPromptRunner(author, initialData)
  const channelStore = new DiscordChannel(channel)
  let finalData = {}
  try {
    finalData = await runner.runArray([
      noFeedsNode,
      rootNode
    ], channelStore)
  } catch (err) {
    const translate = Translator.createProfileTranslator(initialData.profile)
    if (err instanceof Errors.UserInactivityError) {
      await message.channel.send(translate('structs.MenuUtils.closedInactivity'))
    } else if (err instanceof Errors.UserVoluntaryExitError) {
      await message.channel.send(translate('structs.MenuUtils.closed'))
    } else {
      throw err
    }
  }
  await deleteMessages(channel, channelStore.messages)
  return finalData
}

module.exports = runWithFeedsProfile

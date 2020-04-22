const { DiscordPrompt } = require('discord.js-prompts')
const commonPrompts = require('../common/index.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 */

/**
 * @param {Data} data
 */
function selectSourceFeedsVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const selectFeedVisual = commonPrompts.selectFeed.visual(data)
  const menu = selectFeedVisual.menu
  menu.enableMultiSelect()
  const embed = menu.embed
  embed.setDescription(`${embed.description}\n\n${translate('structs.FeedSelector.multiSelect')}`)
  return selectFeedVisual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectSourceFeedsFn (message, data) {
  const { feeds } = data
  const { content } = message
  const sourceFeeds = content
    .split(',')
    .map(index => feeds[Number(index) - 1])
  return {
    ...data,
    sourceFeeds
  }
}

const prompt = new DiscordPrompt(selectSourceFeedsVisual, selectSourceFeedsFn)

exports.prompt = prompt

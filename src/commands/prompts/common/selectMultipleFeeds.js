const { MenuEmbed } = require('discord.js-prompts')
const LocalizedPrompt = require('./utils/LocalizedPrompt.js')
const selectFeed = require('./selectFeed.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 */

/**
 * @param {Data} data
 */
function selectMultipleFeedsVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const selectFeedVisual = selectFeed.visual(data)
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
async function selectMultipleFeedsFn (message, data) {
  const { feeds } = data
  const { content } = message
  const selectedFeeds = MenuEmbed.getMultiSelectOptionRange(content)
    .map((index) => feeds[index - 1])
  return {
    ...data,
    selectedFeeds
  }
}

const prompt = new LocalizedPrompt(selectMultipleFeedsVisual, selectMultipleFeedsFn)

exports.visual = selectMultipleFeedsVisual
exports.fn = selectMultipleFeedsFn
exports.prompt = prompt

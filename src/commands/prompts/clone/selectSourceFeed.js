const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
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
function selectSourceFeedVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const selectFeedVisual = commonPrompts.selectFeed.visual(data)
  const embed = selectFeedVisual.menu.embed
  embed.setDescription(`${translate('commands.clone.copyFrom')}\n\n${embed.description}`)
  return selectFeedVisual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectSourceFeedFn (message, data) {
  const { feeds } = data
  const { content } = message
  const feedIndex = Number(content) - 1
  const selectedFeed = feeds[feedIndex]
  return {
    ...data,
    sourceFeed: selectedFeed
  }
}

const prompt = new LocalizedPrompt(selectSourceFeedVisual, selectSourceFeedFn)

exports.prompt = prompt

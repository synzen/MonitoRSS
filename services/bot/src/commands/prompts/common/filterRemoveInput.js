const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('./utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {string} filterCategory
 * @property {import('../../../structs/db/Feed.js')|import('../../../structs/db/Subscriber.js')} target
 */

/**
 * @param {Data} data
 */
function visual (data) {
  const { filterCategory, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.utils.filters.removeFilterConfirm', {
    category: filterCategory
  }))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function fn (message, data) {
  const { target, filterCategory, selectedFeed: feed } = data
  const { content } = message
  const removeList = content
    .split('\n')
    .map(item => item.trim().toLowerCase())
    .filter((item, index, self) => item && index === self.indexOf(item))
  const remove = []
  const skip = []

  for (const item of removeList) {
    const index = target.getFilterIndex(filterCategory, item)
    if (index === -1) {
      skip.push(item)
    } else {
      remove.push(item)
    }
  }
  if (remove.length > 0) {
    const log = createLogger(message.client.shard.ids[0])
    log.info({
      guild: message.guild,
      user: message.author,
      target
    }, `Removed filters from ${feed.url}: ${remove.join('\n')}`)
    await target.removeFilters(filterCategory, remove)
  }

  return {
    ...data,
    removedInputFilters: remove,
    skippedInputFilters: skip
  }
}

const prompt = new LocalizedPrompt(visual, fn)

exports.prompt = prompt

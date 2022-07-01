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
  return new MessageVisual(translate('commands.utils.filters.promptAdd', {
    type: filterCategory
  }))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function fn (message, data) {
  const { target, filterCategory, selectedFeed: feed } = data
  const { content } = message
  const addList = content
    .split('\n')
    .map(item => item.trim().toLowerCase())
    .filter((item, index, self) => item && index === self.indexOf(item))
  const add = []
  const skip = []

  for (const item of addList) {
    if (target.getFilterIndex(filterCategory, item) === -1) {
      add.push(item)
    } else {
      skip.push(item)
    }
  }
  if (add.length > 0) {
    const log = createLogger(message.client.shard.ids[0])
    log.info({
      guild: message.guild,
      user: message.author,
      feed: target
    }, `Added filters to ${feed.url}: ${add.join('\n')}`)
    await target.addFilters(filterCategory, add)
  }

  return {
    ...data,
    addedInputFilters: add,
    skippedInputFilters: skip
  }
}

const prompt = new LocalizedPrompt(visual, fn)

exports.prompt = prompt

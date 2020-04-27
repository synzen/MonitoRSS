const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {string} selected
 */

/**
 * @param {Data} data
 */
function inputPrependCharacterVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.split.promptPrependChar'))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function inputPrependCharacterFn (message, data) {
  const { client, guild, author, content } = message
  const { selectedFeed: feed } = data
  const log = createLogger(client.shard.ids[0])

  if (content === 'reset') {
    delete feed.split.prepend
    await feed.save()
    log.info({
      guild,
      user: author
    }, `Message splitting prepend character for ${feed.url} resetting`)
  } else {
    feed.split.prepend = content
    await feed.save()
    log.info({
      guild: guild,
      user: author
    }, `Message splitting prepend character for ${feed.url} setting to ${content}`)
  }
  return data
}

const prompt = new LocalizedPrompt(inputPrependCharacterVisual, inputPrependCharacterFn)

exports.prompt = prompt

const { Rejection, MessageVisual } = require('discord.js-prompts')
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
function inputMaxLengthVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.split.promptMaxLen'))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function inputMaxLengthFn (message, data) {
  const { client, guild, author, content } = message
  const { selectedFeed: feed, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const log = createLogger(client.shard.ids[0])

  const num = Number(content)
  if (isNaN(num) || num < 500 || num > 1950) {
    throw new Rejection(translate('commands.split.setInvalidMaxLen'))
  }

  if (content === 'reset') {
    delete feed.split.maxLength
    await feed.save()
    log.info({
      guild,
      user: author
    }, `Message splitting maxLength for ${feed.url} resetting`)
  } else {
    feed.split.maxLength = num
    await feed.save()
    log.info({
      guild: guild,
      user: author
    }, `Message splitting maxLength for ${feed.url} setting to ${content}`)
  }
  return data
}

const prompt = new LocalizedPrompt(inputMaxLengthVisual, inputMaxLengthFn)

exports.prompt = prompt

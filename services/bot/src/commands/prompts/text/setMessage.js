const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get
const createLogger = require('../../../util/logger/create.js')
const Feed = require('../../../structs/db/Feed')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {import('../../../structs/db/Profile.js')} profile
 */

/**
 * @param {Data} data
 */
function setMessageVisual (data) {
  const config = getConfig()
  const profile = data.profile
  const { locale } = profile || {}
  const { text, url } = data.selectedFeed
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  let currentMsg = ''
  if (text) {
    currentMsg = '```Markdown\n' + text + '```'
  } else {
    currentMsg = `\`\`\`Markdown\n${Translator.translate('commands.text.noSetText', locale)}\n\n\`\`\`\`\`\`\n` + config.feeds.defaultText + '```'
  }
  return new MessageVisual(Translator.translate('commands.text.prompt', locale, {
    prefix,
    currentMsg,
    link: url
  }))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function setMessageFn (message, data) {
  const text = message.content
  const selectedFeed = data.selectedFeed
  const log = createLogger(message.client.shard.ids[0])
  if (text === 'reset') {
    selectedFeed.text = undefined
  } else {
    selectedFeed.text = text
  }
  await selectedFeed.save()
  if (selectedFeed.disabled === Feed.DISABLE_REASONS.BAD_FORMAT) {
    await selectedFeed.enable()
  }
  log.info({
    guild: message.guild,
    text
  }, `Text set for ${selectedFeed.url}`)
  return data
}

const prompt = new LocalizedPrompt(setMessageVisual, setMessageFn)

exports.prompt = prompt

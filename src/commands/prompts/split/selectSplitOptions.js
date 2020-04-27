const { MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

// Replace backticks with zero-width space and backtick to escape
const escapeBackticks = (str) => str.replace('`', '​`')
const defSplitCharStr = translate => translate('commands.split.defaultIsValue', { value: `\`\\n\` (${translate('commands.split.newLine')})` })
const defPrependCharStr = translate => translate('commands.split.defaultIsNothing')
const defAppendCharStr = defPrependCharStr
const defMaxLenStr = translate => translate('commands.split.defaultIsValue', { value: '1950' })

/**
 * @param {Data} data
 */
function selectSplitOptionsVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed()
    .setTitle(translate('commands.split.messageSplittingOptions'))
    .setDescription(translate('commands.split.description', {
      title: feed.title,
      link: feed.url,
      currently: translate('generics.enabledLower')
    }))

  const splitOptions = feed.split
  const currentSplitChar = splitOptions && splitOptions.char ? splitOptions.char : ''
  const currentSplitPrepend = splitOptions && splitOptions.prepend ? splitOptions.prepend : ''
  const currentSplitAppend = splitOptions && splitOptions.append ? splitOptions.append : ''
  const currentSplitLength = splitOptions && splitOptions.maxLength ? splitOptions.maxLength : ''

  const curSplitCharStr = translate('commands.split.currentlySetTo', {
    value: escapeBackticks(currentSplitChar)
  })
  const curPrependCharStr = translate('commands.split.currentlySetTo', {
    value: escapeBackticks(currentSplitPrepend)
  })
  const curAppendCharStr = translate('commands.split.currentlySetTo', {
    value: escapeBackticks(currentSplitAppend)
  })
  const curMaxLenStr = translate('commands.split.currentlySetTo', {
    value: currentSplitLength
  })
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.split.optionSetSplitChar'), `${translate('commands.split.optionSetSplitCharDescription')}${currentSplitChar ? ` ${curSplitCharStr}` : ''} ${defSplitCharStr(translate)}`)
    .addOption(translate('commands.split.optionSetPrependChar'), `${translate('commands.split.optionSetPrependCharDescription')}${currentSplitPrepend ? ` ${curPrependCharStr}` : ''} ${defPrependCharStr(translate)}`)
    .addOption(translate('commands.split.optionSetAppendChar'), `${translate('commands.split.optionSetAppendCharDescription')}${currentSplitAppend ? ` ${curAppendCharStr}` : ''} ${defAppendCharStr(translate)}`)
    .addOption(translate('commands.split.optionSetMaxLength'), `${translate('commands.split.optionSetMaxLengthDescription')}${currentSplitLength ? ` ${curMaxLenStr}` : ''} ${defMaxLenStr(translate)}`)
    .addOption(translate('commands.split.optionDisable'), '\u200b')

  return new MenuVisual(menu)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectSplitOptionsFn (message, data) {
  const { client, guild, author, content: selected } = message
  const { selectedFeed: feed } = data
  const log = createLogger(client.shard.ids[0])
  if (selected === '5') {
    feed.split = undefined
    await feed.save()
    log.info({
      guild,
      user: author
    }, `Disabled message splitting for ${feed.url}`)
  }
  return {
    ...data,
    selected
  }
}

const prompt = new LocalizedPrompt(selectSplitOptionsVisual, selectSplitOptionsFn)

exports.prompt = prompt

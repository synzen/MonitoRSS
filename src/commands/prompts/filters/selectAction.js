const { Rejection, MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const FailRecord = require('../../../structs/db/FailRecord.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 */

/**
 * @param {Data} data
 */
function selectCustomizationVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed({
    title: translate('commands.filters.feedFiltersCustomization')
  })
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.filters.optionAddFilters'), translate('commands.filters.optionAddFiltersDescription'))
    .addOption(translate('commands.filters.optionRemoveFilters'), translate('commands.filters.optionRemoveFiltersDescription'))
    .addOption(translate('commands.filters.optionRemoveAllFilters'), translate('commands.filters.optionRemoveAllFiltersDescription'))
    .addOption(translate('commands.filters.optionListFilters'), translate('commands.filters.optionListFiltersDescription'))
    .addOption(translate('commands.filters.optionSendArticle'), translate('commands.filters.optionSendArticleDescription'))

  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectCustomizationFn (message, data) {
  const { profile, selectedFeed: feed } = data
  const { content: selected } = message
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const log = createLogger(message.client.shard.ids[0])
  const translate = Translator.createProfileTranslator(profile)

  // 1 = add (need more input, next node), 2 = remove (need more input, next node)
  if (selected === '1' || selected === '2') {
    return {
      ...data,
      selected,
      target: feed
    }
  } else if (selected === '3') {
    await feed.removeAllFilters()
    log.info({
      guild: message.guild,
      user: message.author
    }, `Removed all filters from ${feed.url}`)
  } else if (selected === '5') {
    if (!feed.hasFilters() && !feed.hasRFilters()) {
      throw new Rejection(translate('commands.filters.noFiltersTryAgain', {
        link: feed.url
      }))
    }
    if (await FailRecord.hasFailed(feed.url)) {
      throw new Rejection(translate('commands.filters.connectionFailureLimit', {
        prefix
      }))
    }
  }
  // 4 = list (next node), 5 = send passing article (next node)
  return {
    ...data,
    selected
  }
}

const prompt = new LocalizedPrompt(selectCustomizationVisual, selectCustomizationFn)

exports.prompt = prompt

const { MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed.js')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const mentionFilterPrompts = require('../mention.filters/index.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {import('../../../structs/db/Subscriber')} selectedSubscriber
 */

/**
 * @param {Data} data
 */
function selectActionVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed({
    title: translate('commands.mention.filters.title'),
    description: translate('commands.sub.filters.description', {
      link: feed.url
    })
  })
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.sub.filters.optionAddFilters'), translate('commands.sub.filters.optionAddFiltersDescription'))
    .addOption(translate('commands.sub.filters.optionRemoveFilters'), translate('commands.sub.filters.optionRemoveFiltersDescription'))
    .addOption(translate('commands.sub.filters.optionRemoveAllFilters'), translate('commands.sub.filters.optionRemoveAllFiltersDescription'))
    .addOption(translate('commands.sub.filters.optionListFilters'), translate('commands.sub.filters.optionListFiltersDescription'))
    .addOption(translate('commands.sub.filters.optionSendFilteredArticle'), translate('commands.sub.filters.optionSendFilteredArticleDescription'))
  const visual = new MenuVisual(menu)
  return visual
}

const prompt = new LocalizedPrompt(selectActionVisual, mentionFilterPrompts.selectAction.fn)

exports.prompt = prompt

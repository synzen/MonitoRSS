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
 * @property {import('../../../structs/db/Subscriber.js')} selectedSubscriber
 */

/**
 * @param {Data} data
 */
function selectActionVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed({
    title: translate('commands.mention.filters.title'),
    description: translate('commands.mention.filters.description', {
      link: feed.url
    })
  })
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.mention.filters.optionAddFilter'))
    .addOption(translate('commands.mention.filters.optionRemoveFilter'))
    .addOption(translate('commands.mention.filters.optionRemoveAllFilters'))
    .addOption(translate('commands.mention.filters.optionListFilters'))
  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectActionFn (message, data) {
  const { content: selected, client, guild, author } = message
  const { selectedSubscriber: subscriber } = data
  if (selected === '3') {
    await subscriber.removeAllFilters()
    const log = createLogger(client.shard.ids[0])
    log.info({
      guild,
      user: author
    }, `Removed all filters from subscriber ${subscriber.id}`)
  }
  return {
    ...data,
    selected,
    // target is for the common filter prompts
    target: subscriber
  }
}

const prompt = new LocalizedPrompt(selectActionVisual, selectActionFn)

exports.visual = selectActionVisual
exports.fn = selectActionFn
exports.prompt = prompt

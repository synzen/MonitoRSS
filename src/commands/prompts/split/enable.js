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

/**
 * @param {Data} data
 */
function enableVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed()
    .setTitle(translate('commands.split.messageSplittingOptions'))
    .setDescription(translate('commands.split.description', {
      title: feed.title,
      link: feed.url,
      currently: translate('generics.disabledLower')
    }))
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.split.optionEnable'), translate('commands.split.optionEnableDescription'))

  return new MenuVisual(menu)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function enableFn (message, data) {
  const { client, guild, author } = message
  const { selectedFeed: feed } = data
  feed.split = {
    enabled: true
  }
  await feed.save()
  const log = createLogger(client.shard.ids[0])
  log.info({
    guild: guild,
    user: author
  }, `Enabled message splitting for ${feed.url}`)
  return data
}

const prompt = new LocalizedPrompt(enableVisual, enableFn)

exports.prompt = prompt

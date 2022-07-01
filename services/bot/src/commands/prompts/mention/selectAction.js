const { MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Subscriber = require('../../../structs/db/Subscriber.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

/**
 * @param {Data} data
 */
function selectActionVisual (data) {
  const { profile } = data
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed({
    title: translate('commands.mention.subscriberOptions'),
    description: translate('commands.mention.description', { prefix })
  })
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.mention.optionAddSubscriber'), translate('commands.mention.optionAddSubscriberDescription'))
    .addOption(translate('commands.mention.optionRemoveSubscriber'), translate('commands.mention.optionRemoveSubscriberDescription'))
    .addOption(translate('commands.mention.optionRemoveAllSubscribers'), translate('commands.mention.optionRemoveAllSubscribersDescription'))
    .addOption(translate('commands.mention.optionListSubscribers'), translate('commands.mention.optionListSubscribersDescription'))
  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectActionFn (message, data) {
  const { content: selected } = message
  const { selectedFeed: feed } = data
  if (selected === '3') {
    const subscribers = await Subscriber.getManyBy('feed', feed._id)
    await Promise.all(subscribers.map(s => s.delete()))
  }
  return {
    ...data,
    selected
  }
}

const prompt = new LocalizedPrompt(selectActionVisual, selectActionFn)

exports.prompt = prompt

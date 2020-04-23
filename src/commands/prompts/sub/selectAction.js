const { MessageEmbed } = require('discord.js')
const { Rejection, DiscordPrompt, MenuEmbed, MenuVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 */

/**
 * @param {Data} data
 */
function selectActionVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new MessageEmbed({
    title: translate('commands.sub.title'),
    description: translate('commands.sub.description')
  })
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.sub.optionAddRole'), translate('commands.sub.optionAddRoleDescription'))
    .addOption(translate('commands.sub.optionAddMe'), translate('commands.sub.optionAddMeDescription'))
    .addOption(translate('commands.sub.optionSubscribedFeeds'), translate('commands.sub.optionSubscribedFeedsDescription'))
  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectActionFn (message, data) {
  const { content: selected, member } = message
  const { feeds, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  if (selected === '1') {
    const subscribers = await Promise.all(feeds.map(f => f.getSubscribers()))
    if (subscribers.every(arr => arr.length === 0)) {
      throw new Rejection(translate('commands.sub.noEligible'))
    }
    return {
      ...data,
      selected,
      subscribers
    }
  } else if (selected === '3') {
    return {
      ...data,
      selected,
      member
    }
  }
  return {
    ...data,
    selected
  }
}

const prompt = new DiscordPrompt(selectActionVisual, selectActionFn)

exports.prompt = prompt

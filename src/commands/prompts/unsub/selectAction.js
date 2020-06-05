const { Rejection, MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

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
  const embed = new ThemedEmbed({
    title: translate('commands.sub.title'),
    description: translate('commands.sub.description')
  })
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.unsub.optionRemoveRole'), translate('commands.unsub.optionRemoveRoleDescription'))
    .addOption(translate('commands.unsub.optionRemoveMyself'), translate('commands.unsub.optionRemoveMyselfDescription'))
    .addOption(translate('commands.unsub.optionRemoveAll'), translate('commands.unsub.optionRemoveAllDescription'))
    .addOption(translate('commands.sub.optionSubscribedFeeds'), translate('commands.sub.optionSubscribedFeedsDescription'))
  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectActionFn (message, data) {
  const { guild, author, content: selected, client, member } = message
  const { feeds, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const memberRoles = member.roles.cache
  const log = createLogger(client.shard.ids[0], {
    guild,
    user: author
  })

  if (selected === '1') {
    const subscribers = await Promise.all(feeds.map(f => f.getSubscribers()))
    const flatSubscribers = subscribers.flat()
    // Make sure some member role is a subscriber of some feed
    if (!memberRoles.some(role => flatSubscribers.some(s => s.id === role.id))) {
      throw new Rejection(translate('commands.unsub.noEligibleRoles'))
    }
    return {
      ...data,
      selected,
      member,
      subscribers
    }
  }

  if (selected === '2') {
    const subscribers = await Promise.all(feeds.map(f => f.getSubscribers()))
    if (!subscribers.flat().some(s => s.id === member.id)) {
      throw new Rejection(translate('commands.unsub.noEligibleDirect'))
    }
    return {
      ...data,
      selected,
      member,
      subscribers
    }
  }

  // Remove all
  if (selected === '3') {
    // Remove user
    const subscribers = await Promise.all(feeds.map(f => f.getSubscribers()))
    /** @type {import('../../../structs/db/Subscriber.js')[]} */
    const flatSubscribers = subscribers.flat()
    const meSubscribers = flatSubscribers.filter(s => s.id === member.id)
    if (meSubscribers.length > 0) {
      await Promise.all(meSubscribers.map(s => s.delete()))
      log.info({
        meSubscribers
      }, 'Removed direct subscribers')
    }
    // Remove roles
    const removeRoles = memberRoles.filter(role => flatSubscribers.some(s => s.id === role.id))
    if (removeRoles.size > 0) {
      await member.roles.remove(removeRoles)
      log.info({
        removedRoles: removeRoles.map(r => `${r.name} (${r.id})`)
      }, 'Removed role subscribers')
    }
    return {
      ...data,
      selected
    }
  }

  if (selected === '4') {
    return {
      ...data,
      selected,
      member
    }
  }
}

const prompt = new LocalizedPrompt(selectActionVisual, selectActionFn)

exports.prompt = prompt

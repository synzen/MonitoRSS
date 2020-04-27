const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

/**
 * @param {Data} data
 */
async function listSubscribersVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const subscribers = await feed.getSubscribers()

  if (subscribers.length === 0) {
    return new MessageVisual(translate('commands.mention.listSubscribersDescription', {
      link: feed.url,
      channel: `<#${feed.channel}>`
    }))
  }

  let output = `${translate('commands.mention.listSubscribersDescription', {
    link: feed.url,
    channel: `<#${feed.channel}>`
  })}\n`
  const userSubscribers = subscribers.filter(s => s.type === 'user')
  const roleSubscribers = subscribers.filter(s => s.type === 'role')

  const userSubscribersString = userSubscribers
    .map(s => `<@${s.id}>`)
    .join(' ')
  const roleSubscribersString = roleSubscribers
    .map(s => `<@&${s.id}>`)
    .join(' ')

  if (userSubscribersString) {
    output += `\n**Users**\n${userSubscribersString}`
  }
  if (roleSubscribersString) {
    output += `\n**Roles**\n${roleSubscribersString}`
  }
  return new MessageVisual(output, {
    // It may be so large, the message will have to be split
    split: true
  })
}

const prompt = new LocalizedPrompt(listSubscribersVisual)

exports.prompt = prompt

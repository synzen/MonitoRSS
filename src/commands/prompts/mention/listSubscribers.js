const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const splitMentionsByNewlines = require('../common/utils/splitMentionsByNewlines.js')
const splitTextByNewline = require('../common/utils/splitTextByNewline.js')
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
    return new MessageVisual(translate('commands.mention.listSubscribersNone', {
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

  const userSubscribersStrings = userSubscribers
    .map(s => `<@${s.id}>`)
  const roleSubscribersStrings = roleSubscribers
    .map(s => `<@&${s.id}>`)

  if (userSubscribersStrings.length > 0) {
    output += `\n**Users**\n${splitMentionsByNewlines(userSubscribersStrings)}`
  }
  if (roleSubscribersStrings.length > 0) {
    output += `\n**Roles**\n${splitMentionsByNewlines(roleSubscribersStrings)}`
  }

  const texts = splitTextByNewline(output)
  return texts.map(text => new MessageVisual(text))
}

const prompt = new LocalizedPrompt(listSubscribersVisual)

exports.prompt = prompt

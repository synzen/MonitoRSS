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
  * @param {string[]} mentionStrings
  */
function splitMentionsByNewlines (mentionStrings) {
  // Put 10 mentions on new lines so message splitting work properly
  const outputMentionArrs = []
  for (const substring of mentionStrings) {
    const lastArray = outputMentionArrs[outputMentionArrs.length - 1]
    if (!lastArray || lastArray.length === 10) {
      outputMentionArrs.push([substring])
    } else {
      lastArray.push(substring)
    }
  }
  return outputMentionArrs.map(arr => arr.join(' ')).join('\n')
}

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
  return new MessageVisual(output, {
    // It may be so large, the message will have to be split
    split: true
  })
}

const prompt = new LocalizedPrompt(listSubscribersVisual)

exports.prompt = prompt

const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const splitTextByNewline = require('../common/utils/splitTextByNewline.js')
/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {string} selected
 * @property {import('discord.js').GuildMember} member
 */

/**
 * @param {Data} data
 */
async function listSubscribedFeedsVisual (data) {
  const { profile, feeds, member } = data
  const translate = Translator.createProfileTranslator(profile)
  const allSubscribers = await Promise.all(feeds.map(f => f.getSubscribers()))
  const memberRoles = member.roles.cache
  let output = ''
  for (let i = 0; i < feeds.length; ++i) {
    const feed = feeds[i]
    const subscribers = allSubscribers[i]
    const meSubscribedRoles = memberRoles.filter(r => subscribers.some(s => s.id === r.id))
    let thisFeedOutput = ''
    if (meSubscribedRoles.size > 0) {
      thisFeedOutput += meSubscribedRoles.map(r => `<@&${r.id}>`).join(' ')
    }
    const meSubscribed = subscribers.some(s => s.id === member.id)
    if (meSubscribed) {
      thisFeedOutput += `${thisFeedOutput ? ' ' : ''}<@${member.id}>`
    }
    if (thisFeedOutput) {
      output += `**${feed.url}** (${thisFeedOutput})\n`
    }
  }
  if (!output) {
    return new MessageVisual(translate('commands.sub.noSubscribedFeedsList'))
  } else {
    output = `${translate('commands.sub.subscribedFeedsList')}\n\n${output}`
    const texts = splitTextByNewline(output)
    return texts.map(text => new MessageVisual(text))
  }
}

const prompt = new LocalizedPrompt(listSubscribedFeedsVisual)

exports.prompt = prompt

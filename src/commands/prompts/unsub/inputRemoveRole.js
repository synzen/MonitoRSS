const { Rejection, MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const splitMentionsByNewlines = require('../common/utils/splitMentionsByNewlines.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Subscriber.js')[][]} subscribers
 * @property {import('discord.js').GuildMember} member
 */

/**
 * @param {Data} data
 */
async function inputRemoveRoleVisual (data) {
  const { profile, feeds, member, subscribers } = data
  const translate = Translator.createProfileTranslator(profile)
  const memberRoles = member.roles.cache
  let output = translate('commands.unsub.listInputRole') + '\n'
  for (let i = 0; i < feeds.length; ++i) {
    const feed = feeds[i]
    const feedSubscribers = subscribers[i]
    if (feedSubscribers.length === 0) {
      continue
    }
    const memberSubscribedRoles = memberRoles
      .filter(r => feedSubscribers.some(s => s.id === r.id))
    if (memberSubscribedRoles.size === 0) {
      continue
    }
    output += `\n**${feed.url}** (<#${feed.channel}>)\n`
    const mentionStrings = memberSubscribedRoles.map(r => `<@&${r.id}>`)
    output += splitMentionsByNewlines(mentionStrings) + '\n'
  }
  return new MessageVisual(output, {
    split: true
  })
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function inputRemoveRoleFn (message, data) {
  const { client, member, author, guild, content: roleName } = message
  const { subscribers, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const mention = message.mentions.roles.first()
  /**
   * Input is a role name with no capitalization requirements
   */
  const subscriberIDs = new Set(subscribers.flat().map(s => s.id))
  const memberSubscribedRoles = member.roles.cache
    .filter(role => subscriberIDs.has(role.id))
  const memberRole = memberSubscribedRoles.find(role => role.name.toLowerCase() === roleName.toLowerCase() || (mention && role.id === mention.id))
  if (!memberRole) {
    throw new Rejection(translate('commands.unsub.invalidRole'))
  }
  await member.roles.remove(memberRole)
  const log = createLogger(client.shard.ids[0])
  log.info({
    guild,
    user: author,
    role: memberRole
  }, 'Removed subscriber role from member')
  return {
    ...data,
    removedRole: memberRole
  }
}

const prompt = new LocalizedPrompt(inputRemoveRoleVisual, inputRemoveRoleFn)

exports.prompt = prompt

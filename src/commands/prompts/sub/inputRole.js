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
 */

/**
 * @param {Data} data
 */
function inputRoleVisual (data) {
  const { profile, feeds, subscribers } = data
  const translate = Translator.createProfileTranslator(profile)
  let output = translate('commands.sub.listInputRole') + '\n'
  for (let i = 0; i < feeds.length; ++i) {
    const feed = feeds[i]
    const feedSubscribers = subscribers[i]
    if (feedSubscribers.length === 0) {
      continue
    }
    output += `\n**${feed.url}** (<#${feed.channel}>)\n`
    const mentionStrings = feedSubscribers
      .filter(s => s.type === 'role')
      .map(s => `<@&${s.id}>`)
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
async function inputRoleFn (message, data) {
  const { client, member, author, guild, content: roleName } = message
  const { subscribers, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const mention = message.mentions.roles.first()
  /**
   * Input is a role name with no capitalization requirements
   */
  const subscriberIDs = new Set(subscribers.flat().map(s => s.id))
  const subscriberRoles = guild.roles.cache
    .filter(role => subscriberIDs.has(role.id))
  const matchedRole = subscriberRoles
    .find(role => role.name.toLowerCase() === roleName.toLowerCase() || (mention && role.id === mention.id))
  if (!matchedRole) {
    throw new Rejection(translate('commands.sub.invalidRole'))
  }
  if (member.roles.cache.has(matchedRole.id)) {
    throw new Rejection(translate('commands.sub.alreadyHaveRole'))
  }
  await member.roles.add(matchedRole)
  const log = createLogger(client.shard.ids[0])
  log.info({
    guild,
    user: author,
    role: matchedRole
  }, 'Added subscriber role to member')
  return {
    ...data,
    addedRole: matchedRole
  }
}

const prompt = new LocalizedPrompt(inputRoleVisual, inputRoleFn)

exports.prompt = prompt

const { Rejection, DiscordPrompt, MessageVisual } = require('discord.js-prompts')
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
function inputRemoveRoleVisual (data) {
  const { profile, feeds, member, subscribers } = data
  const translate = Translator.createProfileTranslator(profile)
  const memberRoles = member.roles.cache
  let output = ''
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
    output += memberSubscribedRoles
      .map(r => `<@&${r.id}>`)
      .join(' ') + '\n\n'
  }
  output += translate('commands.unsub.listInputRole')
  return new MessageVisual(output)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function inputRemoveRoleFn (message, data) {
  const { client, member, author, guild, content: roleName } = message
  const { subscribers, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  /**
   * Input is a role name with no capitalization requirements
   */
  const subscriberIDs = new Set(subscribers.flat().map(s => s.id))
  const memberSubscribedRoles = member.roles.cache.filter(role => subscriberIDs.has(role.id))
  const memberRole = memberSubscribedRoles.find(role => role.name.toLowerCase() === roleName.toLowerCase())
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

const prompt = new DiscordPrompt(inputRemoveRoleVisual, inputRemoveRoleFn)

exports.prompt = prompt

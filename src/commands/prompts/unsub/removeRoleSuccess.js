const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Subscriber.js')[][]} subscribers
 * @property {import('discord.js').Role} removedRole
 */

/**
 * @param {Data} data
 */
function removeRoleSuccess (data) {
  const { removedRole, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.unsub.roleRemoveSuccess', {
    role: `<@&${removedRole}>`
  }))
}

const prompt = new DiscordPrompt(removeRoleSuccess)

exports.prompt = prompt

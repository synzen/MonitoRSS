const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
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

const prompt = new LocalizedPrompt(removeRoleSuccess)

exports.prompt = prompt

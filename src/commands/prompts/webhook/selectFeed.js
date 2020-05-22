const { Rejection } = require('discord.js-prompts')
const Discord = require('discord.js')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt')
const Translator = require('../../../structs/Translator.js')
const commonSelectFeed = require('../common/selectFeed.js')
/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 */

/**
 * @param {Data} data
 */
function selectFeedVisual (data) {
  return commonSelectFeed.visual(data)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectFeedFn (message, data) {
  const newData = await commonSelectFeed.fn(message, data)
  const { selectedFeed, profile } = newData
  const translate = Translator.createProfileTranslator(profile)
  const channel = message.client.channels.cache.get(selectedFeed.channel)
  if (!channel) {
    throw new Rejection(translate('commands.webhook.missingChannel', {
      channelID: selectedFeed.channel,
      link: selectedFeed.url
    }))
  }
  const manageWebhooksPerm = message.guild.me.permissionsIn(channel)
    .has(Discord.Permissions.FLAGS.MANAGE_WEBHOOKS)
  if (!manageWebhooksPerm) {
    throw new Rejection(translate('commands.webhook.noPermission'))
  }
  return newData
}

const prompt = new LocalizedPrompt(selectFeedVisual, selectFeedFn)

exports.visual = selectFeedVisual
exports.fn = selectFeedFn
exports.prompt = prompt

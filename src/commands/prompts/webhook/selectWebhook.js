const { Rejection, MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

/**
 * @param {Data} data
 */
function selectWebhookVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const webhook = feed.webhook
  return new MessageVisual(`${webhook ? translate('commands.webhook.existingFound', {
    webhookMention: `<@${webhook.id}>`
  }) : ''}${translate('commands.webhook.prompt')}`)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectWebhookFn (message, data) {
  const { profile, selectedFeed: feed } = data
  const { content } = message
  const translate = Translator.createProfileTranslator(profile)
  if (content === '{remove}') {
    if (feed.webhook) {
      feed.webhook = undefined
      await feed.save()
    }
    return {
      ...data,
      removed: true
    }
  }
  const nameRegex = /--name="(((?!(--name|--avatar)).)*)"/
  const avatarRegex = /--avatar="(((?!(--name|--avatar)).)*)"/
  const hookName = content.replace(nameRegex, '').replace(avatarRegex, '').trim()
  const feedChannel = await message.client.channels.fetch(feed.channel)
  const hooks = await feedChannel.fetchWebhooks()
  const hook = hooks.find(h => h.name === hookName)
  if (!hook) {
    throw new Rejection(translate('commands.webhook.notFound', { name: hookName }))
  }
  const customNameSrch = content.match(nameRegex)
  const customAvatarSrch = content.match(avatarRegex)

  const newWebhook = {
    id: hook.id,
    url: hook.url
  }
  if (customNameSrch) {
    if (customNameSrch[1].length > 32 || customNameSrch[1].length < 2) {
      throw new Rejection(translate('commands.webhook.tooLong'))
    }
    newWebhook.name = customNameSrch[1]
  }

  if (customAvatarSrch) {
    newWebhook.avatar = customAvatarSrch[1]
  }

  feed.webhook = newWebhook
  await feed.save()
  const log = createLogger(message.client.shard.ids[0])
  log.info({
    guild: message.guild,
    user: message.author
  }, `Webhook ID ${hook.id} (${hook.name}) connected to feed ${feed.url}`)
  const connected = translate('commands.webhook.connected', {
    clientMention: `<@${message.client.user.id}>`,
    link: feed.url
  })
  if (message.channel.id === feedChannel) {
    await hook.send(connected, {
      username: newWebhook.name,
      avatarURL: newWebhook.avatar
    })
  } else {
    // Some may not want messages to be delivered outside of the current channel
    await message.channel.send(translate('commands.webhook.addSuccess', {
      link: feed.url,
      channel: feed.channel
    }))
  }
  return data
}

const prompt = new LocalizedPrompt(selectWebhookVisual, selectWebhookFn)

exports.prompt = prompt

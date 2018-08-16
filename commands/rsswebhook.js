const dbOps = require('../util/dbOps.js')
const config = require('../config.json')
const storage = require('../util/storage.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const log = require('../util/logger.js')

async function feedSelectorFn (m, data) {
  const { guildRss, rssName } = data
  const existingWebhook = guildRss.sources[rssName].webhook

  const text = `${typeof existingWebhook === 'object' ? 'An existing webhook was found (' + existingWebhook.name + '). You may type `{remove}` to disconnect the existing webhook, or continue and your new setting will overwrite the existing one.\n' : ''}
Type the name of the webhook in this channel you wish to use (case sensitive), or type \`exit\` to cancel.\n
To use a different name or avatar url of the webhook when articles are sent for this particular feed, add parameters \`--name="my new name here"\` or \`--avatar="http://website.com/image.jpg"\`. Placeholders are supported.`

  return { ...data,
    existingWebhook: existingWebhook,
    next: {
      text: text,
      embed: null
    }}
}

async function collectWebhook (m, data) {
  const { hooks } = data
  const webhookName = m.content
  if (webhookName === '{remove}') return { ...data, webhookName: webhookName }

  const nameRegex = /--name="(((?!(--name|--avatar)).)*)"/
  const avatarRegex = /--avatar="(((?!(--name|--avatar)).)*)"/
  const hookName = m.content.replace(nameRegex, '').replace(avatarRegex, '').trim()
  const hook = hooks.find(h => h.name === hookName)
  if (!hook) throw new SyntaxError(`No such webhook named "${hookName}" found for this channel. Try again, or type \`exit\` to cancel.`)
  let customNameSrch = m.content.match(nameRegex)
  let customAvatarSrch = m.content.match(avatarRegex)

  if (customNameSrch) {
    customNameSrch = customNameSrch[1]
    if (customNameSrch.length > 32 || customNameSrch.length < 2) throw new SyntaxError('Webhook name must be between 2 and 32 characters. Try again, or type `exit` to cancel.')
  }
  if (customAvatarSrch) customAvatarSrch = customAvatarSrch[1]
  return { ...data, webhook: hook, customAvatarSrch: customAvatarSrch, customNameSrch: customNameSrch }
}

module.exports = async (bot, message, command) => {
  try {
    if (config.advanced._restrictWebhooks === true && (!storage.vipServers[message.guild.id] || !storage.vipServers[message.guild.id].benefactor.allowWebhooks)) {
      log.command.info(`Unauthorized attempt to access webhooks`, message.guild, message.author)
      return await message.channel.send(`Only patrons have access to webhook use.`)
    }
    if (!message.guild.me.permissionsIn(message.channel).has('MANAGE_WEBHOOKS')) return await message.channel.send(`I must have Manage Webhooks permission in this channel in order to work.`)

    const hooks = await message.channel.fetchWebhooks()
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command })
    const webhookSelector = new MenuUtils.Menu(message, collectWebhook)

    const data = await new MenuUtils.MenuSeries(message, [feedSelector, webhookSelector], { hooks: hooks }).start()
    const { guildRss, rssName, existingWebhook, webhookName, webhook, customAvatarSrch, customNameSrch } = data
    const source = guildRss.sources[rssName]
    if (webhookName === '{remove}') {
      if (typeof existingWebhook !== 'object') await message.channel.send(`There is no webhook assigned to this feed.`)
      else {
        const name = source.webhook.name
        delete source.webhook
        await message.channel.send(`Successfully removed webhook ${name} from the feed <${source.link}>.`)
      }
    } else {
      source.webhook = {
        id: webhook.id,
        name: webhook.name
      }

      if (customNameSrch) source.webhook.name = customNameSrch
      if (customAvatarSrch) source.webhook.avatar = customAvatarSrch
      log.command.info(`Webhook ID ${webhook.id} (${webhook.name}) connecting to feed ${source.link}`, message.guild, message.channel)
      const connected = `I am now connected to ${bot.user}, and will send feed articles for <${source.link}>!`
      webhook.send(connected, { username: customNameSrch, avatarURL: customAvatarSrch })
        .catch(err => {
          if (err.message.includes('avatar_url')) return webhook.send(connected, { username: customNameSrch }).catch(err => log.comamnd.warning(`rsswebhook 2`, message.guild, err)) // This may be a placeholder
        })
    }
    await dbOps.guildRss.update(guildRss)
  } catch (err) {
    log.command.warning(`rsswebhook`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsswebhook 1', message.guild, err))
  }
}

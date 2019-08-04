const dbOpsGuilds = require('../util/db/guilds.js')
const dbOpsVips = require('../util/db/vips.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const log = require('../util/logger.js')

async function feedSelectorFn (m, data) {
  const { guildRss, rssName, translate } = data
  const existingWebhook = guildRss.sources[rssName].webhook

  const text = `${typeof existingWebhook === 'object' ? translate('commands.rsswebhook.existingFound', { name: existingWebhook.name }) : ''}${translate('commands.rsswebhook.prompt')}`

  return { ...data,
    existingWebhook: existingWebhook,
    next: {
      text: text,
      embed: null
    } }
}

async function collectWebhook (m, data) {
  const { hooks, translate } = data
  const webhookName = m.content
  if (webhookName === '{remove}') return { ...data, webhookName: webhookName }

  const nameRegex = /--name="(((?!(--name|--avatar)).)*)"/
  const avatarRegex = /--avatar="(((?!(--name|--avatar)).)*)"/
  const hookName = m.content.replace(nameRegex, '').replace(avatarRegex, '').trim()
  const hook = hooks.find(h => h.name === hookName)
  if (!hook) {
    throw new MenuUtils.MenuOptionError(translate('commands.rsswebhook.notFound', { name: hookName }))
  }
  let customNameSrch = m.content.match(nameRegex)
  let customAvatarSrch = m.content.match(avatarRegex)

  if (customNameSrch) {
    customNameSrch = customNameSrch[1]
    if (customNameSrch.length > 32 || customNameSrch.length < 2) {
      throw new MenuUtils.MenuOptionError(translate('commands.rsswebhook.tooLong'))
    }
  }
  if (customAvatarSrch) customAvatarSrch = customAvatarSrch[1]
  return { ...data, webhook: hook, customAvatarSrch: customAvatarSrch, customNameSrch: customNameSrch }
}

module.exports = async (bot, message, command) => {
  try {
    const [ guildRss, isVipServer ] = await Promise.all([ dbOpsGuilds.get(message.guild.id), dbOpsVips.isVipServer(message.guild.id) ])
    const guildLocale = guildRss ? guildRss.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    if (!isVipServer) {
      log.command.info(`Unauthorized attempt to access webhooks`, message.guild, message.author)
      return await message.channel.send(`Only servers with patron backing have access to webhooks.`)
    }
    if (!message.guild.me.permissionsIn(message.channel).has('MANAGE_WEBHOOKS')) return await message.channel.send(translate('commands.rsswebhook.noPermission'))

    const hooks = await message.channel.fetchWebhooks()
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command }, guildRss)
    const webhookSelector = new MenuUtils.Menu(message, collectWebhook)

    const data = await new MenuUtils.MenuSeries(message, [feedSelector, webhookSelector], { hooks, locale: guildLocale, translate }).start()
    if (!data) return
    const { rssName, existingWebhook, webhookName, webhook, customAvatarSrch, customNameSrch } = data
    const source = guildRss.sources[rssName]
    if (webhookName === '{remove}') {
      if (typeof existingWebhook !== 'object') {
        await message.channel.send(translate('commands.rsswebhook.noneAssigned'))
      } else {
        const name = source.webhook.name
        delete source.webhook
        await message.channel.send(translate('commands.rsswebhook.removeSuccess', { name, link: source.link }))
      }
    } else {
      source.webhook = {
        id: webhook.id,
        name: webhook.name
      }

      if (customNameSrch) source.webhook.name = customNameSrch
      if (customAvatarSrch) source.webhook.avatar = customAvatarSrch
      log.command.info(`Webhook ID ${webhook.id} (${webhook.name}) connecting to feed ${source.link}`, message.guild, message.channel)
      const connected = translate('commands.rsswebhook.connected', { botUser: bot.user, link: source.link })
      webhook.send(connected, { username: customNameSrch, avatarURL: customAvatarSrch })
        .catch(err => {
          if (err.message.includes('avatar_url')) return webhook.send(connected, { username: customNameSrch }).catch(err => log.comamnd.warning(`rsswebhook 2`, message.guild, err)) // This may be a placeholder
        })
    }
    await dbOpsGuilds.update(guildRss)
  } catch (err) {
    log.command.warning(`rsswebhook`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsswebhook 1', message.guild, err))
  }
}

const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Feed = require('../structs/db/Feed.js')
const Supporter = require('../structs/db/Supporter.js')
const log = require('../util/logger.js')

async function feedSelectorFn (m, data) {
  const { feed, translate } = data
  const webhook = feed.webhook

  const text = `${webhook ? translate('commands.webhook.existingFound', { name: webhook.name }) : ''}${translate('commands.webhook.prompt')}`

  return { ...data,
    existingWebhook: webhook,
    next: {
      text: text,
      embed: null
    } }
}

async function collectWebhookFn (m, data) {
  const { hooks, translate } = data
  const webhookName = m.content
  if (webhookName === '{remove}') {
    return { ...data, webhookName }
  }

  const nameRegex = /--name="(((?!(--name|--avatar)).)*)"/
  const avatarRegex = /--avatar="(((?!(--name|--avatar)).)*)"/
  const hookName = m.content.replace(nameRegex, '').replace(avatarRegex, '').trim()
  const hook = hooks.find(h => h.name === hookName)
  if (!hook) {
    throw new MenuUtils.MenuOptionError(translate('commands.webhook.notFound', { name: hookName }))
  }
  let customNameSrch = m.content.match(nameRegex)
  let customAvatarSrch = m.content.match(avatarRegex)

  if (customNameSrch) {
    customNameSrch = customNameSrch[1]
    if (customNameSrch.length > 32 || customNameSrch.length < 2) {
      throw new MenuUtils.MenuOptionError(translate('commands.webhook.tooLong'))
    }
  }
  if (customAvatarSrch) {
    customAvatarSrch = customAvatarSrch[1]
  }
  return { ...data, webhook: hook, customAvatarSrch, customNameSrch }
}

module.exports = async (bot, message, command) => {
  try {
    const [ profile, validServer ] = await Promise.all([
      GuildProfile.get(message.guild.id),
      Supporter.hasValidGuild(message.guild.id)
    ])
    const guildLocale = profile ? profile.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    if (!validServer) {
      log.command.info(`Unauthorized attempt to access webhooks`, message.guild, message.author)
      return await message.channel.send(`Only servers with patron backing have access to webhooks.`)
    }
    if (!message.guild.me.permissionsIn(message.channel).has('MANAGE_WEBHOOKS')) {
      return await message.channel.send(translate('commands.webhook.noPermission'))
    }

    const hooks = await message.channel.fetchWebhooks()
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command }, feeds)
    const collectWebhook = new MenuUtils.Menu(message, collectWebhookFn)

    const data = await new MenuUtils.MenuSeries(message, [feedSelector, collectWebhook], { hooks, locale: guildLocale, translate }).start()
    if (!data) {
      return
    }
    const { feed, existingWebhook, webhookName, webhook, customAvatarSrch, customNameSrch } = data

    if (webhookName === '{remove}') {
      if (typeof existingWebhook !== 'object') {
        await message.channel.send(translate('commands.webhook.noneAssigned'))
      } else {
        feed.webhook = undefined
        await feed.save()
        await message.channel.send(translate('commands.webhook.removeSuccess', { link: feed.url }))
      }
      return
    }

    feed.webhook = {
      id: webhook.id
    }

    if (customNameSrch) {
      feed.webhook.name = customNameSrch
    }
    if (customAvatarSrch) {
      feed.webhook.avatar = customAvatarSrch
    }
    log.command.info(`Webhook ID ${webhook.id} (${webhook.name}) connecting to feed ${feed.url}`, message.guild, message.channel)
    const connected = translate('commands.webhook.connected', { botUser: bot.user, link: feed.url })
    await feed.save()
    webhook.send(connected, { username: customNameSrch, avatarURL: customAvatarSrch })
      .catch(err => {
        if (err.message.includes('avatar_url')) {
          return webhook.send(connected, { username: customNameSrch }).catch(err => log.comamnd.warning(`rsswebhook 2`, message.guild, err)) // This may be a placeholder
        }
      })
  } catch (err) {
    log.command.warning(`rsswebhook`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsswebhook 1', message.guild, err))
  }
}

const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Format = require('../structs/db/Format.js')

async function feedSelectorFn (m, data) {
  const { feed, profile, locale } = data
  const format = await feed.getFormat()
  let currentMsg = ''
  if (format && format.text) {
    currentMsg = '```Markdown\n' + format.text + '```'
  } else {
    currentMsg = `\`\`\`Markdown\n${Translator.translate('commands.rssmessage.noSetMessage', locale)}\n\n\`\`\`\`\`\`\n` + config.feeds.defaultMessage + '```'
  }
  const prefix = profile.prefix || config.bot.prefix
  const nextData = {
    ...data,
    format,
    next: {
      text: Translator.translate('commands.rssmessage.prompt', locale, { prefix, currentMsg, link: feed.url }) }
  }
  return nextData
}

async function messagePromptFn (m, data) {
  const { format, locale } = data
  const input = m.content

  if (input.toLowerCase() === 'reset') {
    return {
      ...data,
      setting: null
    }
  } else if (input === '{empty}' && (!format || format.embeds.length === 0)) {
    // Allow empty messages only if embed is enabled
    throw new MenuUtils.MenuOptionError(Translator.translate('commands.rssmessage.noEmpty', locale))
  } else {
    return {
      ...data,
      setting: input
    }
  }
}

module.exports = async (bot, message, command) => {
  try {
    // const guildRss = await dbOpsGuilds.get(message.guild.id)
    const profile = await GuildProfile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const feeds = profile ? await profile.getFeeds() : []

    const translate = Translator.createLocaleTranslator(guildLocale)
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command, locale: guildLocale }, feeds)
    const messagePrompt = new MenuUtils.Menu(message, messagePromptFn)

    const data = await new MenuUtils.MenuSeries(message, [feedSelector, messagePrompt], { locale: guildLocale, profile }).start()
    if (!data) {
      return
    }
    const { setting, feed, format } = data
    const prefix = profile.prefix || config.bot.prefix

    if (setting === null) {
      if (format) {
        format.text = undefined
        if (format.embeds.length === 0) {
          await format.delete()
        } else {
          await format.save()
        }
      }
      log.command.info(`Message reset for ${feed.url}`, message.guild)
      await message.channel.send(translate('commands.rssmessage.resetSuccess', { link: feed.url }) + `\n \`\`\`Markdown\n${config.feeds.defaultMessage}\`\`\``)
    } else {
      if (format) {
        format.text = setting
        await format.save()
      } else {
        const data = {
          feed: feed.id,
          text: setting
        }
        const newFormat = new Format(data)
        await newFormat.save()
      }
      log.command.info(`New message recorded for ${feed.url}`, message.guild)
      await message.channel.send(`${translate('commands.rssmessage.setSuccess', { link: feed.url })}\n \`\`\`Markdown\n${setting.replace('`', '​`')}\`\`\`\n${translate('commands.rssmessage.reminder', { prefix })} ${translate('generics.backupReminder', { prefix })}${setting.search(/{subscriptions}/) === -1 ? ` ${translate('commands.rssmessage.noSubscriptionsPlaceholder', { prefix })}` : ``}`) // Escape backticks in code blocks by inserting zero-width space before each backtick
    }
  } catch (err) {
    log.command.warning(`rssmessage`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssmessage 1', message.guild, err))
  }
}

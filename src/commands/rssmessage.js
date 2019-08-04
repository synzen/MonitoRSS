const dbOpsGuilds = require('../util/db/guilds.js')
const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')

async function feedSelectorFn (m, data) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const currentMsg = source.message ? '```Markdown\n' + source.message + '```' : `\`\`\`Markdown\n${Translator.translate('commands.rssmessage.noSetMessage', guildRss.locale)}\n\n\`\`\`\`\`\`\n` + config.feeds.defaultMessage + '```'
  const prefix = guildRss.prefix || config.bot.prefix
  const nextData = { guildRss: guildRss,
    rssName: rssName,
    next: {
      text: Translator.translate('commands.rssmessage.prompt', guildRss.locale, { prefix, currentMsg, link: source.link }) }
  }
  return nextData
}

async function messagePromptFn (m, data) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const input = m.content

  if (input.toLowerCase() === 'reset') {
    return { setting: null, guildRss: guildRss, rssName: rssName }
  } else if (input === '{empty}' && (!Array.isArray(source.embeds) || source.embeds.length === 0)) {
    throw new MenuUtils.MenuOptionError(Translator.translate('commands.rssmessage.noEmpty', guildRss.locale)) // Allow empty messages only if embed is enabled
  } else {
    return { setting: input, guildRss: guildRss, rssName: rssName }
  }
}

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const guildLocale = guildRss ? guildRss.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command }, guildRss)
    const messagePrompt = new MenuUtils.Menu(message, messagePromptFn)

    const data = await new MenuUtils.MenuSeries(message, [feedSelector, messagePrompt], { locale: guildLocale }).start()
    if (!data) return
    const { setting, rssName } = data
    const prefix = guildRss.prefix || config.bot.prefix
    const source = guildRss.sources[rssName]

    if (setting === null) {
      delete guildRss.sources[rssName].message
      log.command.info(`Message resetting for ${source.link}`, message.guild)
      await dbOpsGuilds.update(guildRss)
      await message.channel.send(translate('commands.rssmessage.resetSuccess', { link: source.link }) + `\n \`\`\`Markdown\n${config.feeds.defaultMessage}\`\`\``)
    } else {
      source.message = setting
      log.command.info(`New message being recorded for ${source.link}`, message.guild)
      await dbOpsGuilds.update(guildRss)
      await message.channel.send(`${translate('commands.rssmessage.setSuccess', { link: source.link })}\n \`\`\`Markdown\n${setting.replace('`', '​`')}\`\`\`\n${translate('commands.rssmessage.reminder', { prefix })} ${translate('generics.backupReminder', { prefix })}${setting.search(/{subscriptions}/) === -1 ? ` ${translate('commands.rssmessage.noSubscriptionsPlaceholder', { prefix })}` : ``}`) // Escape backticks in code blocks by inserting zero-width space before each backtick
    }
  } catch (err) {
    log.command.warning(`rssmessage`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssmessage 1', message.guild, err))
  }
}

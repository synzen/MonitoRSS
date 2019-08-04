const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MIN_PERMISSION_BOT = ['VIEW_CHANNEL', 'SEND_MESSAGES']
const MIN_PERMISSION_USER = ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_CHANNELS']
const dbOpsGuilds = require('../util/db/guilds.js')
const Translator = require('../structs/Translator.js')

async function selectChannelFn (m, data) {
  const { guildRss, rssNameList } = data
  const rssList = guildRss.sources
  const translate = Translator.createLocaleTranslator(guildRss ? guildRss.locale : undefined)

  const selected = m.content === 'this' ? m.channel : m.mentions.channels.first()
  if (!selected) throw new MenuUtils.MenuOptionError(translate('commands.rssmove.invalidChannel'))
  const me = m.guild.me
  let errors = ''
  if (!me.permissionsIn(selected).has(MIN_PERMISSION_BOT)) errors += translate('commands.rssmove.meMissingPermission', { id: selected.id })
  if (!m.member.permissionsIn(selected).has(MIN_PERMISSION_USER)) errors += translate('commands.rssmove.youMissingPermission', { id: selected.id })

  let feedSpecificErrors = ''
  for (let x = 0; x < rssNameList.length; ++x) {
    let curErrors = ''
    const rssName = rssNameList[x]
    const source = rssList[rssName]
    const hasEmbed = source.embedMessage && Object.keys(source.embedMessage).length > 0
    const sourceChannel = m.guild.channels.get(source.channel)

    if (sourceChannel && selected.id === sourceChannel.id) curErrors += translate('commands.rssmove.alreadyInChannel')
    else {
      if (sourceChannel && !m.member.permissionsIn(sourceChannel).has(MIN_PERMISSION_USER)) {
        errors += translate('commands.rssmove.meMissingPermission', { id: sourceChannel.id })
      }
      if (hasEmbed && !me.permissionsIn(selected).has('EMBED_LINKS')) {
        curErrors += translate('commands.rssmove.meMissingEmbedLinks', { id: selected.id })
      }
      for (const n in rssList) {
        const cur = rssList[n]
        if (cur.channel === selected.id && cur.link === source.link && n !== rssName) {
          errors += translate('commands.rssmove.linkAlreadyExists')
        }
      }
    }
    if (curErrors) feedSpecificErrors += `\n__Errors for <${source.link}>:__${curErrors}${x === rssNameList.length - 1 ? '' : '\n'}`
  }

  // Half the battle for this command is figuring out the right amount of new lines...

  if (feedSpecificErrors && errors) errors += '\n' + feedSpecificErrors
  else if (feedSpecificErrors) errors += feedSpecificErrors

  if (errors) throw new MenuUtils.MenuOptionError(translate('commands.rssmove.moveFailed', { errors }))
  const summary = []
  for (let y = 0; y < rssNameList.length; ++y) {
    const source = rssList[rssNameList[y]]
    source.channel = selected.id
    summary.push(`<${source.link}>`)
  }

  await dbOpsGuilds.update(guildRss)
  log.command.info(`Channel for feeds ${summary.join(',')} moved to ${selected.id} (${selected.name})`, m.guild, m.channel)
  m.channel.send(`${translate('commands.rssmove.moveSuccess', { summary: summary.join('\n'), id: selected.id })} ${translate('generics.backupReminder', { prefix: guildRss.prefix || config.bot.prefix })}`).catch(err => log.command.warning('rssmove 1', err))
  return data
}

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const guildLocale = guildRss ? guildRss.locale : undefined
    const feedSelector = new FeedSelector(message, null, { command: command }, guildRss)
    const selectChannel = new MenuUtils.Menu(message, selectChannelFn, { text: Translator.translate('commands.rssmove.prompt', guildLocale) })
    await new MenuUtils.MenuSeries(message, [feedSelector, selectChannel], { locale: guildLocale }).start()
  } catch (err) {
    log.command.warning(`rssmove`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssmove 1', message.guild, err))
  }
}

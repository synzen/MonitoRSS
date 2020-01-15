const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MIN_PERMISSION_BOT = ['VIEW_CHANNEL', 'SEND_MESSAGES']
const MIN_PERMISSION_USER = ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_CHANNELS']
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Feed = require('../structs/db/Feed.js')

async function selectChannelFn (m, data) {
  const { feeds, selectedFeeds, locale, profile } = data
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const translate = Translator.createLocaleTranslator(locale)

  const selected = m.content === 'this' ? m.channel : m.mentions.channels.first()
  if (!selected) {
    throw new MenuUtils.MenuOptionError(translate('commands.move.invalidChannel'))
  }
  const me = m.guild.me
  let errors = ''
  if (!me.permissionsIn(selected).has(MIN_PERMISSION_BOT)) {
    errors += translate('commands.move.meMissingPermission', { id: selected.id })
  } if (!m.member.permissionsIn(selected).has(MIN_PERMISSION_USER)) {
    errors += translate('commands.move.youMissingPermission', { id: selected.id })
  }

  const formats = await Promise.all(feeds.map(feed => feed.getFormat()))

  let feedSpecificErrors = ''
  for (let x = 0; x < selectedFeeds.length; ++x) {
    const selectedFeed = selectedFeeds[x]
    let curErrors = ''
    const hasEmbed = formats[x] ? formats[x].embeds.length > 0 : false
    const sourceChannel = m.guild.channels.get(selectedFeed.channel)

    if (sourceChannel && selected.id === sourceChannel.id) {
      curErrors += translate('commands.move.alreadyInChannel')
    } else {
      if (sourceChannel && !m.member.permissionsIn(sourceChannel).has(MIN_PERMISSION_USER)) {
        errors += translate('commands.move.meMissingPermission', { id: sourceChannel.id })
      }
      if (hasEmbed && !me.permissionsIn(selected).has('EMBED_LINKS')) {
        curErrors += translate('commands.move.meMissingEmbedLinks', { id: selected.id })
      }
      for (const feed of feeds) {
        if (feed.channel === selected.id && feed.link === selectedFeed.link && feed._id !== selectedFeed.id) {
          errors += translate('commands.move.linkAlreadyExists')
        }
      }
    }
    if (curErrors) {
      feedSpecificErrors += `\n__Errors for <${selectedFeed.url}>:__${curErrors}${x === selectedFeeds.length - 1 ? '' : '\n'}`
    }
  }

  // Half the battle for this command is figuring out the right amount of new lines...

  if (feedSpecificErrors && errors) {
    errors += '\n' + feedSpecificErrors
  } else if (feedSpecificErrors) {
    errors += feedSpecificErrors
  }

  if (errors) {
    throw new MenuUtils.MenuOptionError(translate('commands.move.moveFailed', { errors }))
  }
  const summary = []
  const promises = []
  for (const feed of selectedFeeds) {
    feed.channel = selected.id
    summary.push(`<${feed.url}>`)
    promises.push(feed.save())
  }

  await Promise.all(promises)
  log.command.info(`Channel for feeds ${summary.join(',')} moved to ${selected.id} (${selected.name})`, m.guild, m.channel)
  m.channel.send(`${translate('commands.move.moveSuccess', { summary: summary.join('\n'), id: selected.id })} ${translate('generics.backupReminder', { prefix })}`)
    .catch(err => log.command.warning('rssmove 1', err))
  return data
}

module.exports = async (bot, message, command) => {
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const feedSelector = new FeedSelector(message, null, { command, locale: guildLocale, multiSelect: true }, feeds)
    const selectChannel = new MenuUtils.Menu(message, selectChannelFn, { text: Translator.translate('commands.move.prompt', guildLocale) })
    await new MenuUtils.MenuSeries(message, [feedSelector, selectChannel], { locale: guildLocale, profile }).start()
  } catch (err) {
    log.command.warning(`rssmove`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssmove 1', message.guild, err))
  }
}

const config = require('../config.js')
const FLAGS = require('discord.js').Permissions.FLAGS
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const createLogger = require('../util/logger/create.js')
const MIN_PERMISSION_BOT = [
  FLAGS.VIEW_CHANNEL,
  FLAGS.SEND_MESSAGES
]
const MIN_PERMISSION_USER = [
  FLAGS.VIEW_CHANNEL,
  FLAGS.SEND_MESSAGES,
  FLAGS.MANAGE_CHANNELS
]

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

  let feedSpecificErrors = ''
  for (let i = 0; i < selectedFeeds.length; ++i) {
    const selectedFeed = selectedFeeds[i]
    let curErrors = ''
    const hasEmbed = selectedFeed.embeds.length > 0
    const sourceChannel = m.guild.channels.cache.get(selectedFeed.channel)

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
        if (feed.channel === selected.id && feed.url === selectedFeed.url && feed._id !== selectedFeed._id) {
          errors += translate('commands.move.linkAlreadyExists')
        }
      }
    }
    if (curErrors) {
      feedSpecificErrors += `\n__Errors for <${selectedFeed.url}>:__${curErrors}${i === selectedFeeds.length - 1 ? '' : '\n'}`
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
  const log = createLogger(m.guild.shard.id)
  log.info({
    guild: m.guild,
    channel: m.channel
  }, `Channel for feeds ${summary.join(',')} moved to ${selected.id} (${selected.name})`)
  m.channel.send(`${translate('commands.move.moveSuccess', { summary: summary.join('\n'), id: selected.id })} ${translate('generics.backupReminder', { prefix })}`)
    .catch(err => log.command.warning('rssmove 1', err))
  return data
}

module.exports = async (message, command) => {
  const profile = await Profile.get(message.guild.id)
  const guildLocale = profile ? profile.locale : undefined
  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const feedSelector = new FeedSelector(message, null, {
    command,
    locale: guildLocale,
    multiSelect: true,
    globalSelect: true
  }, feeds)
  const selectChannel = new MenuUtils.Menu(message, selectChannelFn, {
    text: Translator.translate('commands.move.prompt', guildLocale)
  })
  await new MenuUtils.MenuSeries(message, [feedSelector, selectChannel], {
    locale: guildLocale,
    profile
  }).start()
}

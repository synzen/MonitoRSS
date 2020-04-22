const FLAGS = require('discord.js').Permissions.FLAGS
const { Rejection, DiscordPrompt, MessageVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')
const MIN_PERMISSION_BOT = [
  FLAGS.VIEW_CHANNEL,
  FLAGS.SEND_MESSAGES
]
const MIN_PERMISSION_USER = [
  FLAGS.VIEW_CHANNEL,
  FLAGS.SEND_MESSAGES,
  FLAGS.MANAGE_CHANNELS
]

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 * @property {import('../../../structs/db/Feed.js')[]} sourceFeeds
 */

/**
 * @param {Data} data
 */
function selectDestinationChannelVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.move.prompt'))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectDestinationChannelFn (message, data) {
  const { profile, sourceFeeds, feeds } = data
  const { content, member, guild, author } = message
  const translate = Translator.createProfileTranslator(profile)
  const selected = content === 'this' ? message.channel : message.mentions.channels.first()
  if (!selected) {
    throw new Rejection(translate('commands.move.invalidChannel'))
  }
  const me = guild.me
  let errors = ''
  if (!me.permissionsIn(selected).has(MIN_PERMISSION_BOT)) {
    errors += translate('commands.move.meMissingPermission', { id: selected.id })
  } if (!member.permissionsIn(selected).has(MIN_PERMISSION_USER)) {
    errors += translate('commands.move.youMissingPermission', { id: selected.id })
  }

  let feedSpecificErrors = ''
  for (let i = 0; i < sourceFeeds.length; ++i) {
    const selectedFeed = sourceFeeds[i]
    let curErrors = ''
    const hasEmbed = selectedFeed.embeds.length > 0
    const sourceChannel = guild.channels.cache.get(selectedFeed.channel)

    if (sourceChannel && selected.id === sourceChannel.id) {
      curErrors += translate('commands.move.alreadyInChannel')
    } else {
      if (sourceChannel && !member.permissionsIn(sourceChannel).has(MIN_PERMISSION_USER)) {
        errors += translate('commands.move.meMissingPermission', { id: sourceChannel.id })
      }
      if (hasEmbed && !me.permissionsIn(selected).has(FLAGS.EMBED_LINKS)) {
        curErrors += translate('commands.move.meMissingEmbedLinks', { id: selected.id })
      }
      for (const feed of feeds) {
        if (feed.channel === selected.id && feed.url === selectedFeed.url && feed._id !== selectedFeed._id) {
          errors += translate('commands.move.linkAlreadyExists')
        }
      }
    }
    if (curErrors) {
      feedSpecificErrors += `\n__Errors for <${selectedFeed.url}>:__${curErrors}${i === sourceFeeds.length - 1 ? '' : '\n'}`
    }
  }

  if (feedSpecificErrors && errors) {
    errors += '\n' + feedSpecificErrors
  } else if (feedSpecificErrors) {
    errors += feedSpecificErrors
  }

  if (errors) {
    throw new Rejection(translate('commands.move.moveFailed', { errors }))
  }

  const promises = []
  for (const feed of sourceFeeds) {
    feed.channel = selected.id
    promises.push(feed.save())
  }
  await Promise.all(promises)
  const log = createLogger()
  log.info({
    guild,
    user: author
  }, `Channel for feeds ${feeds.map(f => f.url).join(',')} moved to ${selected.id} (${selected.name})`)
  return {
    ...data,
    destinationChannel: selected
  }
}

const prompt = new DiscordPrompt(selectDestinationChannelVisual, selectDestinationChannelFn)

exports.prompt = prompt

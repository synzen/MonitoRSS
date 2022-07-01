const { Rejection, MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')
const Feed = require('../../../structs/db/Feed')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {number} targetEmbedIndex
 */

/**
 * @param {Data} data
 */
function selectPropertiesVisual (data) {
  const { profile, selectedFeed: feed, targetEmbedIndex } = data
  const translate = Translator.createProfileTranslator(profile)

  let currentEmbedProps = ''
  const selectedEmbed = feed.embeds[targetEmbedIndex]
  // Show what the user has now
  if (selectedEmbed) {
    for (const property in selectedEmbed) {
      if (property !== 'fields') {
        currentEmbedProps += `[${property}]: ${selectedEmbed[property]}\n\n`
      }
    }
  }
  if (currentEmbedProps.length === 0) {
    currentEmbedProps = '```\nNo properties set.\n'
  } else {
    currentEmbedProps = `\`\`\`Markdown\n# ${translate('commands.embed.currentProperties')} #\n\n` + currentEmbedProps
  }
  const m1 = translate('commands.embed.currentPropertiesList', { link: feed.url, list: currentEmbedProps })

  // Then list available properties

  let embedPropertiesListed = `\`\`\`Markdown\n# ${translate('commands.embed.availableProperties')} #\n\n`
  embedPropertiesListed += `[Title]: ${translate('commands.embed.titleDescription')}\n\n`
  embedPropertiesListed += `[Description]: ${translate('commands.embed.descriptionDescription')}\n\n`
  embedPropertiesListed += `[URL]: ${translate('commands.embed.urlDescription')}\n\n`
  embedPropertiesListed += `[Color]: ${translate('commands.embed.colorDescription')}\n\n`
  embedPropertiesListed += `[Timestamp]: ${translate('commands.embed.timestampDescription')}\n\n`
  embedPropertiesListed += `[Footer Icon URL]: ${translate('commands.embed.footerIconURLDescription')}\n\n`
  embedPropertiesListed += `[Footer Text]: ${translate('commands.embed.footerTextDescription')}\n\n`
  embedPropertiesListed += `[Thumbnail URL]: ${translate('commands.embed.thumbnailURLDescription')}\n\n`
  embedPropertiesListed += `[Image URL]: ${translate('commands.embed.imageURLDescription')}\n\n`
  embedPropertiesListed += `[Author Name]: ${translate('commands.embed.authorNameDescription')}\n\n`
  embedPropertiesListed += `[Author URL]: ${translate('commands.embed.authorURLDescription')}\n\n`
  embedPropertiesListed += `[Author Icon URL]: ${translate('commands.embed.authorIconURLDescription')}\n\n\`\`\``

  const m2 = translate('commands.embed.availablePropertiesList', { list: embedPropertiesListed })
  const mFull = m1 + m2
  // const mFull = (m1 + m2).length < 1995 ? `${m1}\n${m2}` : [m1, m2] // Separate into two messages if it exceeds Discord's max length of 2000
  if (mFull.length < 1995) {
    return new MessageVisual(`${m1}\n${m2}`)
  } else {
    return [
      new MessageVisual(m1),
      new MessageVisual(m2)
    ]
  }
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectPropertiesFn (message, data) {
  const { profile, selectedFeed: feed, targetEmbedIndex } = data
  const { content } = message
  const translate = Translator.createProfileTranslator(profile)
  const inputs = new Map([
    ['title', 'title'],
    ['description', 'description'],
    ['url', 'url'],
    ['color', 'color'],
    ['timestamp', 'timestamp'],
    ['footer icon url', 'footerIconURL'],
    ['footer text', 'footerText'],
    ['thumbnail url', 'thumbnailURL'],
    ['image url', 'imageURL'],
    ['author name', 'authorName'],
    ['author url', 'authorURL'],
    ['author icon url', 'authorIconURL']
  ])
  if (content === 'reset') {
    feed.embeds.splice(targetEmbedIndex, 1)
    await feed.save()
    const log = createLogger()
    log.info({
      guild: message.guild,
      user: message.author
    }, `Embed[${targetEmbedIndex}] deleted`)
    if (feed.disabled === Feed.DISABLE_REASONS.BAD_FORMAT) {
      await feed.enable()
    }
    return {
      ...data,
      reset: true
    }
  }

  // Clean values
  const properties = content
    .split(',')
    .map(i => i.trim())
    .filter((val, index, self) => index === self.indexOf(val))
  // Check if invalid
  const invalids = []
  for (const property of properties) {
    const lowercasedProperty = property.toLowerCase()
    if (!inputs.has(lowercasedProperty)) {
      invalids.push(property)
    }
  }
  // Reject if necessary
  if (invalids.length > 0) {
    throw new Rejection(translate('commands.embed.invalidProperties', { invalids }))
  }

  const values = properties.map(p => inputs.get(p.toLowerCase()))
  return {
    ...data,
    properties: values
  }
}

const prompt = new LocalizedPrompt(selectPropertiesVisual, selectPropertiesFn)

exports.prompt = prompt

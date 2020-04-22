const { MessageEmbed } = require('discord.js')
const { DiscordPrompt, MenuEmbed, MenuVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 */

/**
 * @param {Error} err
 * @param {import('discord.js').Message} message
 */
async function handlePaginationError (err, message) {
  const log = createLogger(message.client.shard.ids[0])
  const newEmbed = new MessageEmbed(message.embeds[0])
    .setFooter(`Failed to enable pagination ${err.message}`)
  try {
    await message.edit(message.content, newEmbed)
  } catch (err) {
    log.warn({
      error: err,
      guild: message.guild
    }, 'Pagination controls error')
  }
}

/**
 * @param {Data} data
 */
function selectFeedVisual (data) {
  const feeds = data.feeds
  const { locale } = data.profile || {}
  const translate = Translator.createLocaleTranslator(locale)
  const embed = new MessageEmbed({
    title: translate('structs.FeedSelector.feedSelectionMenu'),
    description: `${translate('structs.FeedSelector.prompt')} ${translate('structs.FeedSelector.exitToCancel')} `
  })
  const menu = new MenuEmbed(embed)
    .enablePagination(handlePaginationError)

  for (const feed of feeds) {
    const title = feed.title.length > 200 ? feed.title.slice(0, 200) + '...' : feed.title
    const url = feed.url.length > 500 ? translate('commands.list.exceeds500Characters') : feed.url
    menu.addOption(title, `Channel: <#${feed.channel}>\nURL: ${url}`)
  }
  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectFeedFn (message, data) {
  const feeds = data.feeds
  const index = Number(message.content) - 1
  return {
    ...data,
    selectedFeed: feeds[index]
  }
}

const prompt = new DiscordPrompt(selectFeedVisual, selectFeedFn)

exports.visual = selectFeedVisual
exports.fn = selectFeedFn
exports.prompt = prompt

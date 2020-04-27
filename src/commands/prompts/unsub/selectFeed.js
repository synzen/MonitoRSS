const { MessageEmbed } = require('discord.js')
const { DiscordPrompt, MenuEmbed, MenuVisual } = require('discord.js-prompts')
const commonPrompts = require('../common/index.js')
const handlePaginationError = require('../common/utils/handlePaginationError.js')
const Subscriber = require('../../../structs/db/Subscriber.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Subscriber.js')[][]} subscribers
 * @property {import('discord.js').GuildMember} member
 */

/**
 * @param {Data} data
 */
function selectFeedVisual (data) {
  const { feeds, profile, subscribers, member } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new MessageEmbed({
    title: translate('structs.FeedSelector.feedSelectionMenu'),
    description: `${translate('commands.unsub.directRemoveList')} ${translate('structs.FeedSelector.prompt')} ${translate('structs.FeedSelector.exitToCancel')} `
  })
  const menu = new MenuEmbed(embed)
    .enablePagination(handlePaginationError)

  /** @type {import('../../../structs/db/Subscriber.js')[]} */
  const meSubscribers = subscribers.flat().filter(s => s.id === member.id)
  for (const feed of feeds) {
    if (!meSubscribers.some(s => s.feed === feed._id)) {
      // Ignore feeds that this member is not directly subscribed to
      continue
    }
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
  const newData = await commonPrompts.selectFeed.fn(message, data)
  const { selectedFeed: feed } = newData
  const { author, client, guild } = message
  const feedID = feed._id
  const existingSubscriber = await Subscriber.getByQuery({
    feed: feedID,
    id: author.id
  })
  if (existingSubscriber) {
    await existingSubscriber.delete()
    const log = createLogger(client.shard.ids[0])
    log.info({
      guild,
      user: author
    }, `Removed direct subscriber of feed ${feed.url}`)
  }
  return {
    ...newData,
    newSubscriber: false
  }
}

const prompt = new DiscordPrompt(selectFeedVisual, selectFeedFn)

exports.prompt = prompt

const { MessageVisual } = require('discord.js-prompts')
const ArticleMessage = require('../../../structs/ArticleMessage.js')
const FeedFetcher = require('../../../util/FeedFetcher.js')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const Discord = require('discord.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {import('../../../structs/db/Subscriber.js')} selectedSubscriber
 * @property {import('discord.js').TextChannel} channel
 */

/**
 * @param {Data} data
 */
async function sendTestArticleVisual (data) {
  const {
    profile,
    selectedFeed: feed,
    selectedSubscriber: subscriber,
    channel
  } = data
  const filters = subscriber.hasRFilters() ? subscriber.rfilters : subscriber.filters
  const article = await FeedFetcher.fetchRandomArticle(feed.url, filters)
  if (!article) {
    const translate = Translator.createProfileTranslator(profile)
    return new MessageVisual(translate('commands.filters.noArticlesPassed'))
  }
  const articleMessage = await ArticleMessage.create(feed, article)
  const articleMessageChannel = articleMessage.getChannel(channel.client)
  const { text, options } = articleMessage.createTextAndOptions(
    articleMessageChannel instanceof Discord.Webhook ? feed.webhook : null
  )

  return new MessageVisual(text, {
    ...options,
    allowedMentions: {
      parse: []
    }
  })
}

const prompt = new LocalizedPrompt(sendTestArticleVisual)

exports.prompt = prompt

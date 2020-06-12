const { MessageVisual } = require('discord.js-prompts')
const NewArticle = require('../../../structs/NewArticle.js')
const FeedFetcher = require('../../../util/FeedFetcher.js')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

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
  const articleMessage = await (new NewArticle(article, feed))
    .getArticleMessage(channel.client)
  const { embeds, text } = articleMessage.generateMessage()
  const options = articleMessage.createOptions(embeds, articleMessage.getChannel())

  return new MessageVisual(text, options)
}

const prompt = new LocalizedPrompt(sendTestArticleVisual)

exports.prompt = prompt

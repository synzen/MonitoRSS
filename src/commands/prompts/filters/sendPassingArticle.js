const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const FailRecord = require('../../../structs/db/FailRecord.js')
const Translator = require('../../../structs/Translator.js')
const FeedFetcher = require('../../../util/FeedFetcher.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {string} selected
 */

/**
 * @param {Data} data
 */
async function visual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  if (!feed.hasFilters()) {
    return new MessageVisual(translate('commands.filters.noFilters', {
      link: feed.url
    }))
  }
  if (await FailRecord.hasFailed(feed.url)) {
    return new MessageVisual(translate('commands.filters.connectionFailureLimit'))
  }
  const filters = feed.hasRFilters() ? feed.rfilters : feed.filters
  const article = await FeedFetcher.fetchRandomArticle(feed.url, filters)
  if (!article) {
    return new MessageVisual(translate('commands.filters.noArticlesPassed'))
  }
  return new MessageVisual('Sending article...')
}

const prompt = new LocalizedPrompt(visual)

exports.prompt = prompt

const { MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const handlePaginationError = require('../common/utils/handlePaginationError.js')
const getConfig = require('../../../config.js').get
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {string} optionKey
 */

const boolToText = bool => bool ? 'Enabled' : 'Disabled'

/**
 * @param {Data} data
 */
function selectFeedWithOptionVisual (data) {
  const { profile, optionKey, feeds } = data
  const config = getConfig()
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed({
    title: translate('structs.FeedSelector.feedSelectionMenu'),
    description: `${translate('structs.FeedSelector.prompt')} ${translate('structs.FeedSelector.exitToCancel')} `
  })
  const menu = new MenuEmbed(embed)
    .enablePagination(handlePaginationError)

  for (const feed of feeds) {
    const title = feed.title.length > 200 ? feed.title.slice(0, 200) + '...' : feed.title
    const url = feed.url.length > 500 ? translate('commands.list.exceeds500Characters') : feed.url
    let optionName
    if (optionKey === 'imgPreviews') {
      optionName = translate('commands.options.imagePreviews')
    } else if (optionKey === 'imgLinksExistence') {
      optionName = translate('commands.options.imageLinksExistence')
    } else if (optionKey === 'checkDates') {
      optionName = translate('commands.options.dateChecks')
    } else if (optionKey === 'formatTables') {
      optionName = translate('commands.options.tableFormatting')
    } else if (optionKey === 'directSubscribers') {
      optionName = translate('commands.options.directSubscribers')
    }
    let settingState
    if (typeof feed[optionKey] === 'boolean') {
      settingState = boolToText(feed[optionKey])
    } else {
      settingState = boolToText(config.feeds[optionKey]) + ' (default)'
    }
    menu.addOption(title, `Channel: <#${feed.channel}>\nURL: ${url}\n${optionName}: ${settingState}`)
  }
  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectFeedWithOptionFn (message, data) {
  const { feeds, optionKey } = data
  const config = getConfig()
  const log = createLogger(message.client.shard.ids[0])
  const feed = feeds[Number(message.content) - 1]

  const globalSetting = config.feeds[optionKey]
  const feedSetting = feed[optionKey]
  feed[optionKey] = typeof feedSetting === 'boolean' ? !feedSetting : !globalSetting

  if (feed[optionKey] === globalSetting) {
    // undefined marks it for deletion
    feed[optionKey] = undefined
  }

  await feed.save()
  log.info({
    guild: message.guild
  }, `${optionKey} set to ${feed[optionKey]} for feed ${feed.url}. ${feed[optionKey] === undefined ? 'Now following global settings.' : ''}`)
  return {
    ...data,
    selectedFeed: feed
  }
}

const prompt = new LocalizedPrompt(selectFeedWithOptionVisual, selectFeedWithOptionFn)

exports.prompt = prompt

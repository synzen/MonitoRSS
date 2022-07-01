const { PromptNode } = require('discord.js-prompts')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const Subscriber = require('../structs/db/Subscriber.js')
const Translator = require('../structs/Translator.js')
const commonPrompts = require('./prompts/common/index.js')
const subFilterPrompts = require('./prompts/sub.filters/index.js')
const mentionFilterPrompts = require('./prompts/mention.filters/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

/**
 * @param {import('../structs/db/Feed.js')[]} feeds
 * @param {import('../structs/db/Subscriber.js')[]} subscribers
 * @param {string} subscriberID
 */
function subscribedToAnyFeed (feeds, subscribers) {
  const feedIDs = new Set(feeds.map(f => f._id))
  const subscribersOfServer = subscribers.filter(s => feedIDs.has(s.feed))
  return subscribersOfServer.length > 0
}

module.exports = async (message) => {
  const [feeds, subscribers, profile] = await Promise.all([
    Feed.getManyBy('guild', message.guild.id),
    Subscriber.getManyBy('id', message.author.id),
    Profile.get(message.guild.id)
  ])
  if (!subscribedToAnyFeed(feeds, subscribers)) {
    const translate = Translator.createProfileTranslator(profile)
    return message.channel.send(translate('commands.sub.filters.noSubscribedFeeds'))
  }
  const selectFeedNode = new PromptNode(subFilterPrompts.selectFeed.prompt)
  const selectActionNode = new PromptNode(subFilterPrompts.selectAction.prompt)

  // Path 1 - Add filters
  const filterAddCategorySelectCondition = data => data.selected === '1'
  const filterAddCategorySelectNode = new PromptNode(commonPrompts.filterAddCategorySelect.prompt, filterAddCategorySelectCondition)
  const filterAddInputNode = new PromptNode(commonPrompts.filterAddInput.prompt)
  const filterAddInputSuccessNode = new PromptNode(commonPrompts.filterAddInputSuccess.prompt)

  filterAddCategorySelectNode.addChild(filterAddInputNode)
  filterAddInputNode.addChild(filterAddInputSuccessNode)

  // Path 2 - Removed filters
  // No Filters
  const noFiltersToRemoveCondition = data => data.selected === '2' && !data.selectedSubscriber.hasFilters()
  const noFiltersToRemoveNode = new PromptNode(mentionFilterPrompts.listFilters.prompt, noFiltersToRemoveCondition)

  // With Filters
  const filterRemoveCategorySelectCondition = data => data.selected === '2'
  const filterRemoveCategorySelectNode = new PromptNode(commonPrompts.filterRemoveCategorySelect.prompt, filterRemoveCategorySelectCondition)
  const filterRemoveInputNode = new PromptNode(commonPrompts.filterRemoveInput.prompt)
  const filterRemoveInputSuccessNode = new PromptNode(commonPrompts.filterRemoveInputSuccess.prompt)

  filterRemoveCategorySelectNode.addChild(filterRemoveInputNode)
  filterRemoveInputNode.addChild(filterRemoveInputSuccessNode)

  // Path 3 - Removed all filters
  const removeAllFiltersSuccessNodeCondition = data => data.selected === '3'
  const removeAllFiltersSuccessNode = new PromptNode(mentionFilterPrompts.removeAllFiltersSuccess.prompt, removeAllFiltersSuccessNodeCondition)

  // Path 4 - List filters
  const listFiltersNodeCondition = data => data.selected === '4'
  const listFilterNode = new PromptNode(mentionFilterPrompts.listFilters.prompt, listFiltersNodeCondition)

  // Path 5 - Send test article
  const sendTestArticleNodeCondition = data => data.selected === '5'
  const sendTestArticleNode = new PromptNode(subFilterPrompts.sendTestArticle.prompt, sendTestArticleNodeCondition)

  selectFeedNode.addChild(selectActionNode)
  selectActionNode.setChildren([
    filterAddCategorySelectNode,
    noFiltersToRemoveNode,
    filterRemoveCategorySelectNode,
    removeAllFiltersSuccessNode,
    listFilterNode,
    sendTestArticleNode
  ])

  await runWithFeedGuild(selectFeedNode, message, {
    subscribers,
    channel: message.channel
  })
}

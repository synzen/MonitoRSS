const config = require('../../config.json')
const testFilters = require('./filters.js')
const generateEmbed = require('./embed.js')
const Article = require('../../structs/Article.js')
const getSubs = require('./subscriptions.js')

module.exports = (guildRss, rssName, rawArticle, isTestMessage, ignoreLimits) => {
  const rssList = guildRss.sources
  const source = rssList[rssName]
  if (!source) return // Might have been removed mid-cycle
  const article = new Article(rawArticle, guildRss, rssName)
  const subscriptionData = getSubs(source, article)
  article.subscriptions = subscriptionData.mentions
  article.subscriptionIds = subscriptionData.ids
  const IGNORE_TEXT_LIMITS = ignoreLimits === undefined ? !!source.splitMessage : ignoreLimits // If ignoreLimits was passed in, use this value - otherwise follow the source

  // Filter message
  let filterExists = false
  if (source.filters && typeof source.filters === 'object') {
    for (var prop in source.filters) {
      if (prop !== 'roleSubscriptions') filterExists = true // Check if any filter categories exists, excluding roleSubs as they are not filters
    }
  }
  const filterResults = filterExists ? testFilters(source, article) : true

  let textFormat = source.message === undefined ? source.message : source.message.trim()
  let embedFormat = source.embedMessage

  // See if there are any filter-specific messages
  if (Array.isArray(source.filteredFormats)) {
    let matched = { }
    let highestPriority = -1
    let selectedFormat
    const filteredFormats = source.filteredFormats
    for (var a = 0; a < filteredFormats.length; ++a) {
      const filteredFormat = filteredFormats[a]
      const thisPriority = filteredFormat.priority === undefined || filteredFormat.priority < 0 ? 0 : filteredFormat.priority
      const res = testFilters(filteredFormat, article) // messageFiltered.filters must exist as an object
      if (!res.passed) continue
      matched[thisPriority] = matched[thisPriority] === undefined ? 1 : matched[thisPriority] + 1
      if (thisPriority >= highestPriority) {
        highestPriority = thisPriority
        selectedFormat = filteredFormat
      }
    }
    // Only formats with 1 match will get the filtered format
    if (highestPriority > -1 && matched[highestPriority] === 1) {
      textFormat = selectedFormat.message === true ? textFormat : selectedFormat.message // If it's true, then it will use the feed's (or the config default, if applicable) message
      embedFormat = selectedFormat.embedMessage === true ? embedFormat : selectedFormat.embedMessage
    }
  }

  if (!textFormat) textFormat = config.feeds.defaultMessage.trim()

  // Create the message/embed package that will be returned
  const finalMessageCombo = { parsedArticle: article, passedFilters: filterExists ? filterExists && filterResults.passed : true }

  // Determine what the text is, based on whether an embed exists
  if (typeof embedFormat === 'object' && typeof source.embedMessage.properties === 'object' && Object.keys(embedFormat.properties).length > 0) {
    finalMessageCombo.embed = generateEmbed(embedFormat, article)
    finalMessageCombo.text = textFormat === '{empty}' ? '' : article.convertKeywords(textFormat, IGNORE_TEXT_LIMITS)
  } else finalMessageCombo.text = article.convertKeywords(textFormat === '{empty}' ? config.feeds.defaultMessage : textFormat, IGNORE_TEXT_LIMITS)

  // Generate test details
  if (isTestMessage) {
    let testDetails = ''
    const footer = '\nBelow is the configured message to be sent for this feed:\n\n--'
    testDetails += `\`\`\`Markdown\n# BEGIN TEST DETAILS #\`\`\`\`\`\`Markdown`

    if (article.title) {
      testDetails += `\n\n[Title]: {title}\n${article.title}`
    }

    if (article.summary && article.summary !== article.description) { // Do not add summary if summary === description
      let testSummary
      if (article.description && article.description.length > 500) testSummary = (article.summary.length > 500) ? `${article.summary.slice(0, 490)} [...]\n\n**(Truncated summary for shorter rsstest)**` : article.summary // If description is long, truncate summary.
      else testSummary = article.summary
      testDetails += `\n\n[Summary]: {summary}\n${testSummary}`
    }

    if (article.description) {
      let testDescrip
      if (article.summary && article.summary.length > 500) testDescrip = (article.description.length > 500) ? `${article.description.slice(0, 490)} [...]\n\n**(Truncated description for shorter rsstest)**` : article.description // If summary is long, truncate description.
      else testDescrip = article.description
      testDetails += `\n\n[Description]: {description}\n${testDescrip}`
    }

    if (article.date) testDetails += `\n\n[Published Date]: {date}\n${article.date}`
    if (article.author) testDetails += `\n\n[Author]: {author}\n${article.author}`
    if (article.link) testDetails += `\n\n[Link]: {link}\n${article.link}`
    if (article.subscriptions) testDetails += `\n\n[Subscriptions]: {subscriptions}\n${article.subscriptions.split(' ').length - 1} subscriber(s)`
    if (article.images) testDetails += `\n\n${article.listImages()}`
    const placeholderImgs = article.listPlaceholderImages()
    if (placeholderImgs) testDetails += `\n\n${placeholderImgs}`
    const placeholderAnchors = article.listPlaceholderAnchors()
    if (placeholderAnchors) testDetails += `\n\n${placeholderAnchors}`
    if (article.tags) testDetails += `\n\n[Tags]: {tags}\n${article.tags}`
    if (filterExists) testDetails += `\n\n[Passed Filters?]: ${filterResults.passed ? 'Yes' : 'No'}${filterResults.passed ? filterResults.listMatches(false) + filterResults.listMatches(true) : filterResults.listMatches(true) + filterResults.listMatches(false)}`
    testDetails += '```' + footer

    finalMessageCombo.testDetails = testDetails
  }

  return finalMessageCombo
}

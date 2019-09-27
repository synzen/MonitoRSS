const config = require('../config.js')
const storage = require('../util/storage.js')
const TEST_OPTIONS = { split: { prepend: '```md\n', append: '```' } }
const log = require('../util/logger.js')
const debugFeeds = require('../util/debugFeeds.js').list
const generateEmbeds = require('../rss/translator/embed.js')
const Article = require('./Article.js')
const deletedFeeds = storage.deletedFeeds
const testFilters = require('../rss/translator/filters.js')

class ArticleMessage {
  constructor (article, isTestMessage, skipFilters) {
    if (!article._delivery) throw new Error('article._delivery property missing')
    if (!article._delivery.rssName) throw new Error('article._delivery.rssName property missing')
    if (!article._delivery.source) throw new Error('article._delivery.source property missing')
    this.article = article
    this.isTestMessage = isTestMessage
    this.skipFilters = skipFilters || isTestMessage
    this.channelId = article._delivery.source.channel
    this.channel = storage.bot.channels.get(article._delivery.source.channel)
    if (!this.channel) return
    this.webhook = undefined
    this.sendFailed = 1
    this.rssName = article._delivery.rssName
    this.source = article._delivery.source
    this.toggleRoleMentions = typeof this.source.toggleRoleMentions === 'boolean' ? this.source.toggleRoleMentions : config.feeds.toggleRoleMentions
    this.split = this.source.splitMessage // The split options if the message exceeds the character limit. If undefined, do not split, otherwise it is an object with keys char, prepend, append
    this.parsedArticle = new Article(article, this.source, this.article._delivery.source.dateSettings)
    this.subscriptionIds = this.parsedArticle.subscriptionIds

    this.filterResults = testFilters(this.source.filters, this.parsedArticle)
    this.passedFilters = this.source.filters ? this.filterResults.passed : true

    const { embeds, text } = this.generateMessage()
    this.text = text
    this.embeds = embeds
    this.testDetails = isTestMessage ? this.generateTestMessage() : ''
  }

  async _resolveChannel () {
    if (typeof this.source.webhook !== 'object' || !this.channel.guild.me.permissionsIn(this.channel).has('MANAGE_WEBHOOKS')) return
    try {
      const hooks = await this.channel.fetchWebhooks()
      const hook = hooks.get(this.source.webhook.id)
      if (!hook) return
      const guildId = this.channel.guild.id
      const guildName = this.channel.guild.name
      this.webhook = hook
      this.webhook.guild = { id: guildId, name: guildName }
      let name = this.source.webhook.name ? this.parsedArticle.convertKeywords(this.source.webhook.name) : undefined
      if (name && name.length > 32) name = name.slice(0, 29) + '...'
      if (name && name.length < 2) name = undefined
      this.webhook.name = name
      this.webhook.avatar = this.source.webhook.avatar ? this.parsedArticle.convertImgs(this.source.webhook.avatar) : undefined
      return
    } catch (err) {
      log.general.warning(`Cannot fetch webhooks for ArticleMessage webhook initialization to send message`, this.channel, err, true)
    }
  }

  generateMessage (ignoreLimits = !!this.source.splitMessage) {
    const { source, parsedArticle } = this
    let textFormat = source.message === undefined ? source.message : source.message.trim()
    let embedFormat = source.embeds

    // See if there are any filter-specific messages
    if (Array.isArray(source.filteredFormats)) {
      let matched = { }
      let highestPriority = -1
      let selectedFormat
      const filteredFormats = source.filteredFormats
      for (const filteredFormat of filteredFormats) {
        const thisPriority = filteredFormat.priority === undefined || filteredFormat.priority < 0 ? 0 : filteredFormat.priority
        const res = testFilters(filteredFormat.filters, parsedArticle) // messageFiltered.filters must exist as an object
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
        embedFormat = selectedFormat.embeds === true ? embedFormat : selectedFormat.embeds
      }
    }

    if (!textFormat) {
      textFormat = config.feeds.defaultMessage.trim()
    }

    // Determine what the text is, based on whether an embed exists
    if (Array.isArray(embedFormat) && embedFormat.length > 0) {
      const embeds = generateEmbeds(embedFormat, parsedArticle)
      const text = textFormat === '{empty}' ? '' : parsedArticle.convertKeywords(textFormat, ignoreLimits)
      return { embeds, text }
    } else {
      const text = parsedArticle.convertKeywords(textFormat === '{empty}' ? config.feeds.defaultMessage : textFormat, ignoreLimits)
      return { text }
    }
  }

  generateTestMessage () {
    const { parsedArticle, filterResults } = this
    let testDetails = ''
    const footer = '\nBelow is the configured message to be sent for this feed:\n\n--'
    testDetails += `\`\`\`Markdown\n# BEGIN TEST DETAILS #\`\`\`\`\`\`Markdown`

    if (parsedArticle.title) {
      testDetails += `\n\n[Title]: {title}\n${parsedArticle.title}`
    }

    if (parsedArticle.summary && parsedArticle.summary !== parsedArticle.description) { // Do not add summary if summary === description
      let testSummary
      if (parsedArticle.description && parsedArticle.description.length > 500) {
        testSummary = (parsedArticle.summary.length > 500) ? `${parsedArticle.summary.slice(0, 490)} [...]\n\n**(Truncated summary for shorter rsstest)**` : parsedArticle.summary // If description is long, truncate summary.
      } else {
        testSummary = parsedArticle.summary
      }
      testDetails += `\n\n[Summary]: {summary}\n${testSummary}`
    }

    if (parsedArticle.description) {
      let testDescrip
      if (parsedArticle.summary && parsedArticle.summary.length > 500) {
        testDescrip = (parsedArticle.description.length > 500) ? `${parsedArticle.description.slice(0, 490)} [...]\n\n**(Truncated description for shorter rsstest)**` : parsedArticle.description // If summary is long, truncate description.
      } else {
        testDescrip = parsedArticle.description
      }
      testDetails += `\n\n[Description]: {description}\n${testDescrip}`
    }

    if (parsedArticle.date) testDetails += `\n\n[Published Date]: {date}\n${parsedArticle.date}`
    if (parsedArticle.author) testDetails += `\n\n[Author]: {author}\n${parsedArticle.author}`
    if (parsedArticle.link) testDetails += `\n\n[Link]: {link}\n${parsedArticle.link}`
    if (parsedArticle.subscriptions) testDetails += `\n\n[Subscriptions]: {subscriptions}\n${parsedArticle.subscriptions.split(' ').length - 1} subscriber(s)`
    if (parsedArticle.images) testDetails += `\n\n${parsedArticle.listImages()}`
    const placeholderImgs = parsedArticle.listPlaceholderImages()
    if (placeholderImgs) testDetails += `\n\n${placeholderImgs}`
    const placeholderAnchors = parsedArticle.listPlaceholderAnchors()
    if (placeholderAnchors) testDetails += `\n\n${placeholderAnchors}`
    if (parsedArticle.tags) testDetails += `\n\n[Tags]: {tags}\n${parsedArticle.tags}`
    if (this.source.filters) testDetails += `\n\n[Passed Filters?]: ${this.passedFilters ? 'Yes' : 'No'}${this.passedFilters ? filterResults.listMatches(false) + filterResults.listMatches(true) : filterResults.listMatches(true) + filterResults.listMatches(false)}`
    testDetails += '```' + footer

    return testDetails
  }

  async send () {
    if (!this.source) throw new Error('Missing feed source')
    if (!this.channel) throw new Error('Missing feed channel')
    await this._resolveChannel()
    if (!this.skipFilters && !this.passedFilters) {
      if (config.log.unfiltered === true) log.general.info(`'${this.article.link ? this.article.link : this.article.title}' did not pass filters and was not sent`, this.channel)
      return
    }
    if (deletedFeeds.includes(this.rssName)) throw new Error(`${this.rssName} for channel ${this.channel.id} was deleted during cycle`)

    // Set up the send options
    const textContent = this.isTestMessage ? this.testDetails : this.text.length > 1950 && !this.split ? `Error: Feed Article could not be sent for ${this.article.link} due to a single message's character count >1950.` : this.text.length === 0 && !this.embeds ? `Unable to send empty message for feed article <${this.article.link}> (${this.rssName}).` : this.text
    const options = this.isTestMessage ? TEST_OPTIONS : {}
    if (this.webhook) {
      options.username = this.webhook.name
      options.avatarURL = this.webhook.avatar
    }
    if (!this.isTestMessage && this.embeds) {
      if (this.webhook) options.embeds = this.embeds
      else options.embed = this.embeds[0]
    }
    if (!this.isTestMessage) options.split = this.split

    // Send the message, and repeat attempt if failed
    const medium = this.webhook ? this.webhook : this.channel
    try {
      const m = await medium.send(textContent, options)
      if (this.isTestMessage) {
        this.isTestMessage = false
        return this.send()
      } else return m
    } catch (err) {
      if (err.code === 50013 || this.sendFailed++ === 4) { // 50013 = Missing Permissions
        if (debugFeeds.includes(this.rssName)) log.debug.error(`${this.rssName}: Message has been translated but could not be sent (TITLE: ${this.article.title})`, err)
        throw err
      }
      if (this.split) {
        const tooLong = err.message.includes('2000 or fewer in length')
        const noSplitChar = err.message.includes('no split characters')
        if (tooLong) {
          delete this.split
        }
        if (tooLong || noSplitChar) {
          const messageWithCharacterLimits = this.generateMessage(false) // Regenerate with the character limits for individual placeholders again
          this.embeds = messageWithCharacterLimits.embeds
          this.text = messageWithCharacterLimits.text
          return this.send()
        }
      }
      return this.send()
    }
  }
}

module.exports = ArticleMessage

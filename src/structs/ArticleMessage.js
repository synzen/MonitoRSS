const config = require('../config.js')
const Discord = require('discord.js')
const storage = require('../util/storage.js')
const TEST_OPTIONS = { split: { prepend: '```md\n', append: '```' } }
const log = require('../util/logger.js')
const debugFeeds = require('../util/debugFeeds.js').list
const Article = require('./Article.js')
const deletedFeeds = storage.deletedFeeds
const testFilters = require('../rss/translator/filters.js')

/**
 * @typedef {Object} PreparedArticle
 * @property {string} rssName - The feed ID where this article came from
 * @property {Object} _delivery - Delivery details
 * @property {Object} _delivery.source - The feed source where this article came from
 */

class ArticleMessage {
  /**
   * @param {PreparedArticle} article - The article object
   * @param {boolean} isTestMessage - Whether this should skip filters AND have test details
   * @param {boolean} skipFilters - Whether this should skip filters
   */
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

    const { embeds, text } = this._generateMessage()
    this.text = text
    this.embeds = embeds
    this.testDetails = isTestMessage ? this._generateTestMessage() : ''
  }

  _determineFormat () {
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

    return { textFormat, embedFormat }
  }

  _convertEmbeds (embeds) {
    const { parsedArticle } = this
    const richEmbeds = []
    const convert = parsedArticle.convertKeywords.bind(parsedArticle)
    for (const objectEmbed of embeds) {
      const richEmbed = new Discord.RichEmbed()

      if (objectEmbed.title) {
        const t = parsedArticle.convertKeywords(objectEmbed.title)
        richEmbed.setTitle(t.length > 256 ? t.slice(0, 250) + '...' : t)
      }

      if (objectEmbed.description) {
        richEmbed.setDescription(parsedArticle.convertKeywords(objectEmbed.description))
      }
      if (objectEmbed.url) {
        richEmbed.setURL(parsedArticle.convertKeywords(objectEmbed.url))
      }

      if (objectEmbed.color !== null && objectEmbed.color !== undefined && !isNaN(objectEmbed.color) && objectEmbed.color <= 16777215 && objectEmbed.color >= 0) {
        richEmbed.setColor(parseInt(objectEmbed.color, 10))
      } else if (objectEmbed.color && objectEmbed.color.startsWith('#') && objectEmbed.color.length === 7) {
        richEmbed.setColor(objectEmbed.color)
      }

      const footerText = objectEmbed.footer_text || objectEmbed.footerText
      const footerIconURL = objectEmbed.footer_icon_url || objectEmbed.footerIconUrl
      if (footerText) {
        richEmbed.setFooter(convert(footerText), footerIconURL ? convert(footerIconURL) : undefined)
      }

      const authorName = objectEmbed.author_name || objectEmbed.authorName
      const authorIconURL = objectEmbed.author_icon_url || objectEmbed.authorIconUrl
      if (authorName) {
        richEmbed.setAuthor(convert(authorName), authorIconURL ? convert(authorIconURL) : undefined)
      }

      const thumbnailURL = objectEmbed.thumbnail_url || objectEmbed.thumbnailUrl
      if (thumbnailURL) {
        richEmbed.setThumbnail(thumbnailURL)
      }

      const imageURL = objectEmbed.image_url || objectEmbed.imageUrl
      if (imageURL) {
        richEmbed.setImage(imageURL)
      }

      if (objectEmbed.timestamp) {
        const setting = objectEmbed.timestamp
        richEmbed.setTimestamp(setting === 'article' ? new Date(parsedArticle._fullDate) : setting === 'now' ? new Date() : new Date(setting)) // No need to check for invalid date since discord.js does it
      }

      const fields = objectEmbed.fields
      if (Array.isArray(fields)) {
        for (var x = 0; x < fields.length; ++x) {
          const field = fields[x]
          const inline = field.inline === true

          let title = parsedArticle.convertKeywords(field.title)
          title = title.length > 256 ? title.slice(0, 250) + '...' : title

          let value = parsedArticle.convertKeywords(field.value ? field.value : '')
          value = value.length > 1024 ? value.slice(0, 1020) + '...' : value.length > 0 ? value : '\u200b'

          if (typeof title === 'string' && !title) {
            richEmbed.addBlankField(inline)
          } else if (richEmbed.fields.length < 10) {
            richEmbed.addField(title, value, inline)
          }
        }
      }
      richEmbeds.push(richEmbed)
    }

    return richEmbeds
  }

  async _resolveWebhook () {
    const { channel, source } = this
    if (typeof source.webhook !== 'object' || !channel.guild.me.permissionsIn(channel).has('MANAGE_WEBHOOKS')) return
    try {
      const hooks = await channel.fetchWebhooks()
      const hook = hooks.get(source.webhook.id)
      if (!hook) return
      const guildId = channel.guild.id
      const guildName = channel.guild.name
      this.webhook = hook
      this.webhook.guild = { id: guildId, name: guildName }
      let name = source.webhook.name ? this.parsedArticle.convertKeywords(source.webhook.name) : undefined
      if (name && name.length > 32) name = name.slice(0, 29) + '...'
      if (name && name.length < 2) name = undefined
      this.webhook.name = name
      this.webhook.avatar = source.webhook.avatar ? this.parsedArticle.convertImgs(source.webhook.avatar) : undefined
    } catch (err) {
      log.general.warning(`Cannot fetch webhooks for ArticleMessage webhook initialization to send message`, channel, err, true)
    }
  }

  _generateMessage (ignoreLimits = !!this.source.splitMessage) {
    const { parsedArticle } = this
    const { textFormat, embedFormat } = this._determineFormat()

    // Determine what the text is, based on whether an embed exists
    if (Array.isArray(embedFormat) && embedFormat.length > 0) {
      const embeds = this._convertEmbeds(embedFormat)
      const text = textFormat === '{empty}' ? '' : parsedArticle.convertKeywords(textFormat, ignoreLimits)
      return { embeds, text }
    } else {
      const text = parsedArticle.convertKeywords(textFormat === '{empty}' ? config.feeds.defaultMessage : textFormat, ignoreLimits)
      return { text }
    }
  }

  _generateTestMessage () {
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
    await this._resolveWebhook()
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
          const messageWithCharacterLimits = this._generateMessage(false) // Regenerate with the character limits for individual placeholders again
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

const Discord = require('discord.js')
const Article = require('./Article.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

/**
 * @typedef {Object} PreparedArticle
 * @property {Object} _feed - The feed source where this article came from
 */

class ArticleMessage {
  /**
   * @param {Discord.Client} bot - Discord client
   * @param {PreparedArticle} article - The article object
   * @param {boolean} skipFilters - Whether this should skip filters
   * @param {boolean} debug
   */
  constructor (bot, article, skipFilters = false, debug = false) {
    if (!article._feed) {
      throw new Error('article._feed property missing')
    }
    this.config = getConfig()
    this.log = createLogger(bot.shard.ids[0])
    this.debug = debug
    this.skipFilters = skipFilters
    this.article = article
    this.feed = article._feed
    this.feedID = this.feed._id
    this.profile = this.feed.profile || {}
    this.split = this.feed.split
    this.filters = this.feed.filters
    this.rfilters = this.feed.rfilters
    this.filteredFormats = this.feed.filteredFormats
    /** @type {Discord.TextChannel} */
    this.channelID = this.feed.channel
    this.channel = bot.channels.cache.get(this.channelID)
    if (!this.channel) {
      if (this.debug) {
        this.log.info(`Skipping article delivery due to missing channel (${this.channelID})`)
      }
      return
    }
    this.sendFailed = 0
    this.webhook = undefined
    this.parsedArticle = new Article(article, this.feed, this.profile)

    if (Object.keys(this.feed.rfilters).length > 0) {
      // Regex
      this.filterResults = this.parsedArticle.testFilters(this.rfilters)
    } else {
      // Regular
      this.filterResults = this.parsedArticle.testFilters(this.filters)
    }

    this.subscriptionIDs = this.parsedArticle.subscriptionIds
    const { embeds, text } = this._generateMessage()
    this.text = text
    this.embeds = embeds
  }

  passedFilters () {
    if (this.skipFilters) {
      return true
    } else {
      return this.filterResults.passed
    }
  }

  _determineFormat () {
    const { feed, filteredFormats, parsedArticle } = this
    let text = feed.text || this.config.feeds.defaultText
    let embeds = feed.embeds

    // See if there are any filter-specific messages
    if (filteredFormats.length > 0) {
      const matched = { }
      let highestPriority = -1
      let selectedFormat
      for (const filteredFormat of filteredFormats) {
        let thisPriority = filteredFormat.priority
        if (thisPriority === undefined || thisPriority < 0) {
          thisPriority = 0
        }
        const res = parsedArticle.testFilters(filteredFormat.filters)
        if (!res.passed) {
          continue
        }
        if (matched[thisPriority] === undefined) {
          matched[thisPriority] = 1
        } else {
          ++matched[thisPriority]
        }
        if (thisPriority >= highestPriority) {
          highestPriority = thisPriority
          selectedFormat = filteredFormat
        }
      }
      // Only formats with 1 match will get the filtered format
      if (highestPriority > -1 && matched[highestPriority] === 1) {
        // If it's undefined, then it will use the feed's (or the config default, if applicable) message
        if (selectedFormat.text) {
          text = selectedFormat.text
        }
        if (selectedFormat.embeds) {
          embeds = selectedFormat.embeds
        }
      }
    }

    return { text, embeds }
  }

  _convertEmbeds (embeds) {
    const { parsedArticle } = this
    const richEmbeds = []
    const convert = parsedArticle.convertKeywords.bind(parsedArticle)
    for (const objectEmbed of embeds) {
      const richEmbed = new Discord.MessageEmbed()

      const title = convert(objectEmbed.title)
      if (title) {
        richEmbed.setTitle(title.length > 256 ? title.slice(0, 250) + '...' : title)
      }

      const description = convert(objectEmbed.description)
      if (description) {
        richEmbed.setDescription(description)
      }

      const url = convert(objectEmbed.url)
      if (url) {
        richEmbed.setURL(url)
      }

      const color = objectEmbed.color
      if (color !== null && color !== undefined && color <= 16777215 && color >= 0) {
        richEmbed.setColor(parseInt(color, 10))
      }

      const footerText = convert(objectEmbed.footerText)
      if (footerText) {
        const footerIconURL = convert(objectEmbed.footerIconURL)
        richEmbed.setFooter(footerText, footerIconURL)
      }

      const authorName = convert(objectEmbed.authorName)
      if (authorName) {
        const authorIconURL = convert(objectEmbed.authorIconURL)
        const authorURL = convert(objectEmbed.authorURL)
        richEmbed.setAuthor(authorName, authorIconURL, authorURL)
      }

      const thumbnailURL = convert(objectEmbed.thumbnailURL)
      if (thumbnailURL) {
        richEmbed.setThumbnail(thumbnailURL)
      }

      const imageURL = convert(objectEmbed.imageURL)
      if (imageURL) {
        richEmbed.setImage(imageURL)
      }

      const timestamp = objectEmbed.timestamp
      if (timestamp === 'article') {
        richEmbed.setTimestamp(new Date(parsedArticle.fullDate))
      } else if (timestamp === 'now') {
        richEmbed.setTimestamp(new Date())
      }

      const fields = objectEmbed.fields
      if (Array.isArray(fields)) {
        for (const field of fields) {
          const inline = field.inline === true

          let name = convert(field.name)
          if (name.length > 256) {
            name = name.slice(0, 250) + '...'
          }

          let value = convert(field.value)
          if (value.length > 1024) {
            value = value.slice(0, 1020) + '...'
          }

          if (richEmbed.fields.length < 10) {
            richEmbed.addField(name, value, inline)
          }
        }
      }
      richEmbeds.push(richEmbed)
    }

    return richEmbeds
  }

  async _resolveWebhook () {
    const { channel, feed } = this
    const permission = Discord.Permissions.FLAGS.MANAGE_WEBHOOKS
    if (!feed.webhook || !channel.guild.me.permissionsIn(channel).has(permission)) {
      return
    }
    try {
      const hooks = await channel.fetchWebhooks()
      const hook = hooks.get(feed.webhook.id)
      if (!hook) {
        return
      }
      const guildID = channel.guild.id
      const guildName = channel.guild.name
      this.webhook = hook
      this.webhook.guild = { id: guildID, name: guildName }
      let name
      if (feed.webhook.name) {
        name = this.parsedArticle.convertKeywords(feed.webhook.name)
      }
      if (name) {
        if (name.length > 32) {
          name = name.slice(0, 29) + '...'
        } else if (name.length < 2) {
          name = undefined
        }
      }
      this.webhook.name = name
      this.webhook.avatar = undefined
      if (feed.webhook.avatar) {
        this.webhook.avatar = this.parsedArticle.convertImgs(feed.webhook.avatar)
      }
    } catch (err) {
      this.log.warn({
        channel: this.channel,
        error: err
      }, 'Cannot fetch webhooks for ArticleMessage webhook initialization to send message')
    }
  }

  _generateMessage (ignoreLimits = !!this.split) {
    const { parsedArticle } = this
    const { text, embeds } = this._determineFormat()

    // Determine what the text/sembed are, based on whether an embed exists
    let useEmbeds = embeds
    let useText = text
    if (embeds.length > 0) {
      useEmbeds = this._convertEmbeds(embeds)
      let convert = text
      if (text === '{empty}') {
        convert = ''
      }
      useText = parsedArticle.convertKeywords(convert, ignoreLimits)
    } else {
      let convert = text
      if (text === '{empty}') {
        convert = this.config.feeds.defaultText
      }
      useText = parsedArticle.convertKeywords(convert, ignoreLimits)
    }
    return {
      embeds: useEmbeds,
      text: useText
    }
  }

  _createSendOptions () {
    let text = this.text
    if (this.text.length > 1950 && !this.split) {
      text = `Error: Feed Article could not be sent for ${this.article.link} due to a single message's character count >1950.`
    } else if (this.text.length === 0 && this.embeds.length === 0) {
      text = `Unable to send empty message for feed article <${this.article.link}> (${this.feedID}).`
    }
    const options = {
      allowedMentions: {
        parse: ['roles', 'users', 'everyone']
      }
    }
    if (this.webhook) {
      options.username = this.webhook.name
      options.avatarURL = this.webhook.avatar
    }
    if (this.webhook) {
      options.embeds = this.embeds
    } else {
      options.embed = this.embeds[0]
    }
    options.split = this.split
    return { text, options }
  }

  async send () {
    if (this.config.dev) {
      return null
    }
    if (!this.feed) {
      throw new Error('Missing feed')
    }
    if (!this.channel) {
      throw new Error('Missing feed channel')
    }
    await this._resolveWebhook()
    if (!this.passedFilters()) {
      if (this.config.log.unfiltered === true || this.debug) {
        this.log.info({
          channel: this.channel
        }, `'${this.article.link ? this.article.link : this.article.title}' did not pass filters and was not sent`)
      }
      return
    }

    const { text, options } = this._createSendOptions()

    // Send the message, and repeat attempt if failed
    const medium = this.webhook ? this.webhook : this.channel
    try {
      return await medium.send(text, options)
    } catch (err) {
      // 50013 = Missing Permissions, 50035 = Invalid form
      if (err.code === 50013 || err.code === 50035 || this.sendFailed++ === 3) {
        if (this.debug) {
          this.log.info({
            error: err
          }, `${this.feedID}: Message has been translated but could not be sent (TITLE: ${this.article.title})`)
        }
        throw err
      }
      if (this.split) {
        const tooLong = err.message.includes('2000 or fewer in length')
        const noSplitChar = err.message.includes('no split characters')
        if (tooLong) {
          delete this.split
        }
        if (tooLong || noSplitChar) {
          // Regenerate with the character limits for individual placeholders again
          const { embeds, text } = this._generateMessage(false)
          this.embeds = embeds
          this.text = text
        }
      }
      return this.send()
    }
  }
}

module.exports = ArticleMessage

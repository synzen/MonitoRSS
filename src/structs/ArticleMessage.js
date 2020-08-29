const Discord = require('discord.js')
const Article = require('./Article.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')
const devLevels = require('../util/devLevels.js')
const Feed = require('./db/Feed.js')
const FeedData = require('./FeedData.js')

class ArticleMessage {
  /**
   * @param {Object<string, any>} article
   * @param {import('./FeedData.js')} feedData
   * @param {boolean} debug
   */
  constructor (article, feedData, debug = false) {
    this.config = getConfig()
    this.debug = debug
    this.article = article
    this.feed = feedData.feed
    this.filteredFormats = feedData.filteredFormats
    this.sendFailed = 0
    this.parsedArticle = new Article(article, feedData)
  }

  /**
   * @param {import('./db/Feed.js')|Object<string, any>} feed
   * @param {Object<string, any>} article
   * @param {boolean} debug
   */
  static async create (feed, article, debug) {
    if (feed instanceof Feed) {
      const feedData = await FeedData.ofFeed(feed)
      return new ArticleMessage(article, feedData, debug)
    } else {
      const reconstructedFeed = new Feed(feed)
      const feedData = await FeedData.ofFeed(reconstructedFeed)
      return new ArticleMessage(article, feedData, debug)
    }
  }

  passedFilters () {
    const { filters, rfilters } = this.feed
    if (Object.keys(rfilters).length > 0) {
      return this.parsedArticle.testFilters(rfilters).passed
    } else {
      return this.parsedArticle.testFilters(filters).passed
    }
  }

  /**
   * @param {import('discord.js').Client} bot
   */
  getChannel (bot) {
    const channel = bot.channels.cache.get(this.feed.channel)
    return channel
  }

  determineFormat () {
    const { feed, parsedArticle, filteredFormats } = this
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

  convertEmbeds (embeds) {
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
          } else if (field.name && !name) {
            // If a placeholder is empty
            name = '\u200b'
          }

          let value = convert(field.value)
          if (value.length > 1024) {
            value = value.slice(0, 1020) + '...'
          } else if (field.value && !value) {
            // If a placeholder is empty
            value = '\u200b'
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

  /**
   * @param {import('discord.js').Client} bot
   */
  async getWebhook (bot) {
    const { feed } = this
    const channel = this.getChannel(bot)
    if (!channel) {
      return
    }
    const permission = Discord.Permissions.FLAGS.MANAGE_WEBHOOKS
    if (!feed.webhook || !channel.guild.me.permissionsIn(channel).has(permission)) {
      return
    }
    if (feed.webhook.disabled) {
      return
    }
    try {
      const hooks = await channel.fetchWebhooks()
      const hook = hooks.get(feed.webhook.id)
      if (!hook) {
        return
      }
      return hook
    } catch (err) {
      const log = createLogger(bot.shard.ids[0])
      log.warn({
        channel,
        error: err
      }, 'Cannot fetch webhooks for ArticleMessage webhook initialization to send message')
    }
  }

  /**
   * @param {import('discord.js').Webhook} [webhook]
   */
  getWebhookNameAvatar (webhook) {
    const { feed, parsedArticle } = this
    const options = {
      username: webhook.name,
      avatarURL: webhook.avatarURL()
    }
    if (feed.webhook.name) {
      options.username = parsedArticle.convertKeywords(feed.webhook.name).slice(0, 32)
    }
    if (feed.webhook.avatar) {
      options.avatarURL = parsedArticle.convertImgs(feed.webhook.avatar)
    }
    return options
  }

  generateMessage (ignoreLimits = !!this.feed.split) {
    const { parsedArticle } = this
    const { text, embeds } = this.determineFormat()

    // Determine what the text/embeds are, based on whether an embed exists
    let useEmbeds = embeds
    let useText = text
    if (embeds.length > 0) {
      useEmbeds = this.convertEmbeds(embeds)
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
    if (useText.length > 1950 && !ignoreLimits) {
      useText = `Error: Feed Article could not be sent for ${this.article.link} due to a single message's character count >1950.`
    }
    if (useText.length === 0 && embeds.length === 0) {
      useText = `Unable to send empty message for feed article <${this.article.link}> (${this.feed._id}).`
    }
    return {
      embeds: useEmbeds,
      text: useText
    }
  }

  createOptions (embeds, medium) {
    const isWebhook = medium instanceof Discord.Webhook
    const options = {
      allowedMentions: {
        parse: ['roles', 'users', 'everyone']
      }
    }
    if (isWebhook) {
      options.embeds = embeds
      const webhookSettings = this.getWebhookNameAvatar(medium)
      options.username = webhookSettings.username
      options.avatarURL = webhookSettings.avatarURL
    } else {
      options.embed = embeds[0]
    }
    options.split = this.feed.split
    return options
  }

  createAPIPayload (medium) {
    const { text, embeds } = this.generateMessage()
    const options = this.createOptions(embeds, medium)
    // First convert camel case properties to snake case
    const transformed = {
      ...options,
      allowed_mentions: options.allowedMentions
    }
    delete transformed.allowedMentions
    if (transformed.avatarURL) {
      transformed.avatar_url = options.avatarURL
      delete transformed.avatarURL
    }
    return {
      ...transformed,
      content: text
    }
  }

  createTextAndOptions (medium) {
    const { text, embeds } = this.generateMessage()
    const options = this.createOptions(embeds, medium)
    return {
      text,
      options
    }
  }

  /**
   * @param {import('discord.js').Client} bot
   */
  async getMedium (bot) {
    const webhook = await this.getWebhook(bot)
    if (webhook) {
      return webhook
    }
    const channel = this.getChannel(bot)
    return channel
  }

  /**
   * @param {import('discord.js').Client} bot
   */
  async send (bot) {
    if (devLevels.disableOutgoingMessages()) {
      return
    }
    const medium = await this.getMedium(bot)
    if (!medium) {
      throw new Error('Missing medium to send message to')
    }

    const { text, options } = this.createTextAndOptions(medium)

    // Send the message, and repeat attempt if failed
    try {
      return await medium.send(text, options)
    } catch (err) {
      // 50013 = Missing Permissions, 50035 = Invalid form
      if (err.code === 50013 || err.code === 50035 || this.sendFailed++ === 3) {
        if (this.debug) {
          const log = createLogger(bot.shard.ids[0])
          log.info({
            error: err
          }, `${this.feed._id}: Message has been translated but could not be sent (TITLE: ${this.article.title})`)
        }
        throw err
      }
      return this.send(bot)
    }
  }
}

module.exports = ArticleMessage

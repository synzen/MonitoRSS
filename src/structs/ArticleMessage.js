const Discord = require('discord.js')
const Article = require('./Article.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')
const devLevels = require('../util/devLevels.js')

class ArticleMessage {
  /**
   * @param {Discord.Client} bot
   * @param {Object<string, any>} article
   * @param {import('./FeedData.js')} feedData
   * @param {boolean} debug
   */
  constructor (bot, article, feedData, debug = false) {
    this.bot = bot
    this.config = getConfig()
    this.log = createLogger(bot.shard.ids[0])
    this.debug = debug
    this.article = article
    this.feed = feedData.feed
    this.filteredFormats = feedData.filteredFormats
    this.sendFailed = 0
    this.parsedArticle = new Article(article, feedData)
  }

  passedFilters () {
    const { filters, rfilters } = this.feed
    if (Object.keys(rfilters).length > 0) {
      return this.parsedArticle.testFilters(rfilters).passed
    } else {
      return this.parsedArticle.testFilters(filters).passed
    }
  }

  getChannel () {
    const channel = this.bot.channels.cache.get(this.feed.channel)
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

  async getWebhook () {
    const { feed } = this
    const channel = this.getChannel()
    if (!channel) {
      return
    }
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
      return hook
    } catch (err) {
      this.log.warn({
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

  async getMedium () {
    const webhook = await this.getWebhook()
    if (webhook) {
      return webhook
    }
    const channel = this.getChannel()
    return channel
  }

  async send () {
    if (devLevels.disableOutgoingMessages()) {
      return
    }
    const medium = await this.getMedium()
    if (!medium) {
      throw new Error('Missing medium to send message to')
    }
    if (!this.passedFilters()) {
      if (this.config.log.unfiltered === true || this.debug) {
        this.log.info({
          medium
        }, `'${this.article.link ? this.article.link : this.article.title}' did not pass filters and was not sent`)
      }
      return
    }

    const { text, embeds } = this.generateMessage()
    const options = this.createOptions(embeds, medium)

    // Send the message, and repeat attempt if failed
    try {
      return await medium.send(text, options)
    } catch (err) {
      // 50013 = Missing Permissions, 50035 = Invalid form
      if (err.code === 50013 || err.code === 50035 || this.sendFailed++ === 3) {
        if (this.debug) {
          this.log.info({
            error: err
          }, `${this.feed._id}: Message has been translated but could not be sent (TITLE: ${this.article.title})`)
        }
        throw err
      }
      return this.send()
    }
  }
}

module.exports = ArticleMessage

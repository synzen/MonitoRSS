const config = require('../config.json')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const TEST_OPTIONS = {split: {prepend: '```md\n', append: '```'}}
const log = require('../util/logger.js')
const debugFeeds = require('../util/debugFeeds.js').list
const translate = require('../rss/translator/translate.js')
const deletedFeeds = storage.deletedFeeds

class ArticleMessage {
  constructor (article, isTestMessage, skipFilters) {
    this.article = article
    this.isTestMessage = isTestMessage
    this.skipFilters = skipFilters || isTestMessage
    this.channelId = article.discordChannelId
    this.channel = storage.bot.channels.get(article.discordChannelId)
    if (!this.channel) return
    this.guildRss = currentGuilds.get(this.channel.guild.id)
    this.webhook = undefined
    this.sendFailed = 1
    this.rssName = article.rssName
    this.valid = true
    if (!this.guildRss) {
      this.valid = false
      return log.general.error(`${this.rssName} Unable to initialize an ArticleMessage due to missing guild profile`, this.channel.guild)
    }
    this.source = this.guildRss ? this.guildRss.sources[this.rssName] : undefined
    if (!this.source) {
      this.valid = false
      return log.general.error(`${this.rssName} Unable to initialize an ArticleMessage due to missing source`, this.channel.guild, this.channel)
    }
    this.toggleRoleMentions = typeof this.source.toggleRoleMentions === 'boolean' ? this.source.toggleRoleMentions : config.feeds.toggleRoleMentions
    this.split = this.source.splitMessage // The split options if the message exceeds the character limit. If undefined, do not split, otherwise it is an object with keys char, prepend, append
    this._translate()
  }

  async _resolveChannel () {
    if (((config.advanced._restrictWebhooks === true && storage.vipServers[this.channel.guild.id] && storage.vipServers[this.channel.guild.id].benefactor.allowWebhooks) || !config.advanced._restrictWebhooks) && this.source && typeof this.source.webhook === 'object') {
      if (!this.channel.guild.me.permissionsIn(this.channel).has('MANAGE_WEBHOOKS')) return
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
  }

  _translate (ignoreLimits) {
    const results = translate(this.guildRss, this.rssName, this.article, this.isTestMessage, ignoreLimits)
    this.parsedArticle = results.parsedArticle
    this.subscriptionIds = this.parsedArticle.subscriptionIds
    this.passedFilters = results.passedFilters
    this.testDetails = results.testDetails
    this.embeds = results.embeds
    this.text = results.text
  }

  async send () {
    if (!this.source) throw new Error('Missing feed source')
    if (!this.channel) throw new Error('Missing feed channel')
    await this._resolveChannel()
    if (!this.valid) throw new Error(`Missing ArticleMessage initialization data`)
    if (!this.skipFilters && !this.passedFilters) {
      if (config.log.unfiltered === true) log.general.info(`'${this.article.link ? this.article.link : this.article.title}' did not pass filters and was not sent`, this.channel)
      return
    }
    if (deletedFeeds.includes(this.rssName)) throw new Error(`${this.rssName} for channel ${this.channel.id} was deleted during cycle`)

    // Set up the send options
    const textContent = this.isTestMessage ? this.testDetails : this.text.length > 1950 && !this.split ? `Error: Feed Article could not be sent for ${this.article.link} due to a single message's character count >1950.` : this.text.length === 0 && !this.embeds ? `Unable to send empty message for feed article <${this.article.link}>.` : this.text
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
        return await this.send()
      } else return m
    } catch (err) {
      if (this.split && err.message.includes('2000 or fewer in length')) {
        delete this.split
        this._translate(false)
        return this.send()
      }
      if (this.split && err.message.includes('no split characters')) {
        this._translate(false) // Retranslate with the character limits for individual placeholders again
        return this.send()
      }
      if (err.code === 50013 || this.sendFailed++ === 4) { // 50013 = Missing Permissions
        if (debugFeeds.includes(this.rssName)) log.debug.error(`${this.rssName}: Message has been translated but could not be sent (TITLE: ${this.article.title})`, err)
        throw err
      }
      return this.send()
    }
  }
}

module.exports = ArticleMessage

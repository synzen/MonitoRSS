const ArticleMessage = require('./ArticleMessage.js')
const config = require('../config.js')
const ArticleMessageError = require('../structs/errors/ArticleMessageError.js')

class ArticleMessageQueue {
  constructor (bot) {
    /**
     * Article objects with role subscribers by channel IDs
     * @type {object<string, import('./ArticleMessage.js')>}
     */
    this.queuesWithSubs = {}

    /**
     * @type {import('discord.js').Client}
     */
    this.bot = bot
  }

  /**
   * Change role mentionability of multiple roles within a channel
   * @param {boolean} mentionable - Mentionability to be changed to
   * @param {string} channelID - Channel ID of the role(s)
   * @param {Set<string>} roleIDs - Role IDs to change mentionability of
   * @param {import('discord.js').Client} bot - Discord.js client instance
   */
  static async toggleRoleMentionable (mentionable, channelID, roleIDs, bot) {
    if (roleIDs.size === 0) return
    const channel = bot.channels.get(channelID)
    if (!channel) return
    const guild = channel.guild
    let updated = 0
    try {
      for (const roleID of roleIDs) {
        const role = guild.roles.get(roleID)
        // Other checks may include guild.me.roles.highest.comparePositionTo(role) <= 0, and whether the bot has manage roles permission, but don't check them and let the error show in the message
        if (role && role.mentionable !== mentionable) {
          await role.setMentionable(mentionable)
          ++updated
        }
      }
      return updated
    } catch (err) {
      throw err.code === 50013 ? new Error(`Unable to toggle role permissions because one or more roles are above my role, or I don't have Manage Roles permission.`) : err
    }
  }

  /**
   * Queues up and sends an article to be sent, or if they have role subscriptions, just enqueue instead
   * @param {object} article - Article object
   * @param {boolean} isTestMessage - Whether the calling function is from rsstest
   * @param {boolean} skipFilters - Whether filters should be skipped
   */
  async enqueue (article, isTestMessage, skipFilters) {
    if (config.dev === true) return
    const articleMessage = new ArticleMessage(this.bot, article, isTestMessage, skipFilters)
    await this._pushNext(articleMessage)
  }

  async _pushNext (articleMessage) {
    const delayArticleMessage = articleMessage.toggleRoleMentions && articleMessage.subscriptionIds.length > 0
    const channelId = articleMessage.channelId
    if (!delayArticleMessage) {
      return articleMessage.send()
    }
    if (!this.queuesWithSubs[channelId]) {
      this.queuesWithSubs[channelId] = [articleMessage]
    } else {
      this.queuesWithSubs[channelId].push(articleMessage)
    }
  }

  /**
   * Send all the enqueued articles that require role mention toggles
   */
  async send () {
    for (const channelId in this.queuesWithSubs) {
      const channelQueue = this.queuesWithSubs[channelId]
      if (channelQueue.length === 0) continue
      const cId = channelId
      let roleIds = new Set()
      for (const articleMessage of channelQueue) {
        const messageSubscriptionIds = articleMessage.subscriptionIds
        messageSubscriptionIds.forEach(id => roleIds.add(id))
      }
      try {
        const rolesToggled = await ArticleMessageQueue.toggleRoleMentionable(true, cId, roleIds, this.bot)
        await this._sendDelayedQueue(this.bot, cId, channelQueue, roleIds, undefined, rolesToggled)
      } catch (err) {
        if (err instanceof ArticleMessageError) { // From the _sendDelayedQueue
          await ArticleMessageQueue.toggleRoleMentionable(false, cId, roleIds, this.bot)
          throw err
        }
        await this._sendDelayedQueue(this.bot, cId, channelQueue, roleIds, err, 0)
      }
    }
  }

  async _sendDelayedQueue (bot, channelId, channelQueue, roleIds, err, rolesToggled) {
    const articleMessage = channelQueue[0]
    try {
      if (err) {
        articleMessage.text += `\n\nFailed to toggle role mentions: ${err.message}`
      }
      await articleMessage.send()
      if (channelQueue.length - 1 === 0) {
        delete this.queuesWithSubs[channelId]
        if (!err && rolesToggled > 0) {
          await ArticleMessageQueue.toggleRoleMentionable(false, channelId, roleIds, bot)
        }
      } else {
        await this._sendDelayedQueue(bot, channelId, channelQueue.slice(1, channelQueue.length), roleIds, err, rolesToggled)
      }
    } catch (err) {
      delete this.queuesWithSubs[channelId]
      throw new ArticleMessageError(articleMessage.channel ? articleMessage.channel.guild : undefined, err.message)
    }
  }
}

module.exports = ArticleMessageQueue

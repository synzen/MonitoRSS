const ArticleMessage = require('./ArticleMessage.js')
const config = require('../config.js')
const ArticleMessageError = require('../structs/errors/ArticleMessageError.js')

class ArticleMessageQueue {
  constructor () {
    /**
     * Article objects by channel IDs
     * @type {object.<string, object>}
     */
    this.queues = {}
    /**
     * Article objects with role subscribers by channel IDs
     * @type {object.<string, object>}
     */
    this.queuesWithSubs = {}
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
    const promises = []
    roleIDs.forEach(roleID => {
      const role = guild.roles.get(roleID)
      // Other checks may include guild.me.highestRole.comparePositionTo(role) <= 0, and whether the bot has manage roles permission, but don't check them and let the error show in the message
      if (role && role.mentionable !== mentionable) {
        promises.push(role.setMentionable(mentionable))
      }
    })
    try {
      return await Promise.all(promises)
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
    const articleMessage = new ArticleMessage(article, isTestMessage, skipFilters)
    await this._pushNext(articleMessage)
  }

  async _pushNext (articleMessage) {
    const delayArticleMessage = articleMessage.toggleRoleMentions && articleMessage.subscriptionIds.length > 0
    const channelId = articleMessage.channelId
    const queues = delayArticleMessage ? this.queuesWithSubs : this.queues
    if (!queues[channelId]) {
      queues[channelId] = [articleMessage]
    } else {
      queues[channelId].push(articleMessage)
    }
    if (!delayArticleMessage) {
      await this._sendNext(articleMessage.channelId)
    }
  }

  async _sendNext (channelId) {
    const channelQueue = this.queues[channelId]
    if (channelQueue.length === 0) {
      delete this.queues[channelId]
      return
    }
    const articleMessage = channelQueue.shift()
    await articleMessage.send()
    await this._sendNext(channelId)
  }

  /**
   * Send all the enqueued articles that require role mention toggles
   * @param {import('discord.js').Client} bot - Discord.js client
   */
  async send (bot) {
    const promises = []
    for (const channelId in this.queuesWithSubs) {
      const channelQueue = this.queuesWithSubs[channelId]
      if (channelQueue.length === 0) continue
      const cId = channelId
      let roleIds = new Set()
      for (const articleMessage of channelQueue) {
        const messageSubscriptionIds = articleMessage.subscriptionIds
        messageSubscriptionIds.forEach(id => roleIds.add(id))
      }
      promises.push(
        ArticleMessageQueue.toggleRoleMentionable(true, cId, roleIds, bot)
          .then(() => this._sendDelayedQueue(bot, cId, channelQueue, roleIds))
          .catch(err => this._sendDelayedQueue(bot, cId, channelQueue, roleIds, err))
      )
    }
    await Promise.all(promises)
  }

  async _sendDelayedQueue (bot, channelId, channelQueue, roleIds, err) {
    const articleMessage = channelQueue[0]
    try {
      if (err) {
        articleMessage.text += `\n\nFailed to toggle role mentions: ${err.message}`
      }
      await articleMessage.send()
      if (channelQueue.length - 1 === 0) {
        delete this.queuesWithSubs[channelId]
        if (!err) {
          await ArticleMessageQueue.toggleRoleMentionable(false, channelId, roleIds, bot)
        }
      } else {
        await this._sendDelayedQueue(bot, channelId, channelQueue.slice(1, channelQueue.length), roleIds, err)
      }
    } catch (err) {
      delete this.queuesWithSubs[channelId]
      throw new ArticleMessageError(articleMessage.channel ? articleMessage.channel.guild : undefined, err.message)
    }
  }
}

module.exports = ArticleMessageQueue

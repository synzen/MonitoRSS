const ArticleMessage = require('./ArticleMessage.js')
const config = require('../config.json')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')

function toggleRoleMentionable (mentionable, channelId, roleIds, callback) {
  if (roleIds.length === 0) return callback ? callback() : null
  let done = 0
  const channel = storage.bot.channels.get(channelId)
  if (!channel) return callback ? callback() : null
  const guild = channel.guild
  for (var x = roleIds.length - 1; x >= 0; --x) {
    const role = guild.roles.get(roleIds[x])
    if (!role || guild.me.highestRole.comparePositionTo(role) <= 0 || role.mentionable === mentionable) {
      if (++done >= roleIds.length) return callback ? callback() : null
      continue
    }
    role.setMentionable(mentionable).then(r => {
      if (++done >= roleIds.length && callback) callback()
    }).catch(err => {
      log.general.error(`Unable to toggle role ${role.id} (${role.name}) mentionable to ${mentionable} for article delivery`, guild, err)
      if (++done >= roleIds.length && callback) callback()
    })
  }
}

class ArticleMessageQueue {
  constructor () {
    this.queues = {} // Object of objects (mapped by channel ID) with keys length and queue
    this.queuesWithSubs = {}
  }

  push (article, callback) {
    if (config._skipMessages === true) return
    const articleMessage = new ArticleMessage(article)
    this._pushNext(articleMessage, callback)
  }

  _pushNext (articleMessage, callback) {
    const delayArticleMessage = articleMessage.toggleRoleMentions && articleMessage.subscriptionIds.length > 0
    const channelId = articleMessage.channelId
    const queues = delayArticleMessage ? this.queuesWithSubs : this.queues
    if (!queues[channelId]) queues[channelId] = [articleMessage]
    else queues[channelId].push(articleMessage)
    if (!delayArticleMessage) this._sendNext(articleMessage.channelId, callback)
    else if (callback) callback()
  }

  _sendNext (channelId, callback) {
    const channelQueue = this.queues[channelId]
    if (channelQueue.length === 0) return
    const articleMessage = channelQueue.shift()
    articleMessage.send(err => {
      if (callback) callback(err)
      this._sendNext(channelId, callback)
    })
  }

  sendDelayed () {
    for (var channelId in this.queuesWithSubs) {
      const channelQueue = this.queuesWithSubs[channelId]
      if (channelQueue.length === 0) continue
      const cId = channelId
      let roleIds = []
      for (var x = 0; x < channelQueue.length; ++x) roleIds = roleIds.concat(channelQueue[x].subscriptionIds)
      toggleRoleMentionable(true, cId, roleIds, () => {
        this._sendDelayedQueue(cId, channelQueue, roleIds)
      })
    }
  }

  _sendDelayedQueue (channelId, channelQueue, roleIds) {
    const articleMessage = channelQueue.shift()
    articleMessage.send(err => {
      if (err) log.general.error('Failed to send a delayed articleMessage', err)
      if (channelQueue.length === 0) toggleRoleMentionable(false, channelId, roleIds)
      else this._sendDelayedQueue(channelId, channelQueue, roleIds)
    })
  }
}

module.exports = ArticleMessageQueue

const queues = {} // Object of objects (mapped by channel ID) with keys length and queue
const ArticleMessage = require('../structs/ArticleMessage.js')
const config = require('../config.json')

function sendNext (channelId, callback) {
  const channelQueue = queues[channelId]
  if (channelQueue.length === 0) return
  const message = channelQueue.shift()
  message.send(err => {
    callback(err)
    sendNext(channelId, callback)
  })
}

function pushNext (article) {
  const channelId = article.discordChannelId
  const articleMessage = new ArticleMessage(article)
  if (!queues[channelId]) queues[channelId] = [articleMessage]
  else queues[channelId].push(articleMessage)
}

module.exports = (article, callback) => {
  if (config._skipMessages === true) return
  pushNext(article)
  sendNext(article.discordChannelId, callback)
}

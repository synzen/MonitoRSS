const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const processSources = require('./logic/shared.js')
const debugFeeds = require('../util/debugFeeds').list
const log = require('../util/logger.js')
const storage = require('../util/storage.js')

module.exports = (data, callback) => {
  const { link, rssList, uniqueSettings, logicType } = data
  if (logicType !== 'init' && logicType !== 'cycle') throw new Error(`Expected logicType parameter must be "cycle" or "init", found ${logicType} instead`)
  const feedparser = new FeedParser()
  const articleList = []

  const cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser)
    .then(stream => stream.pipe(feedparser))
    .catch(err => callback(err, { status: 'failed', link: link, rssList: rssList }))

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    callback(err, { status: 'failed', link: link, rssList: rssList })
  })

  feedparser.on('readable', function () {
    let item
    do {
      item = this.read()
      if (item) articleList.push(item)
    } while (item)
  })

  feedparser.on('end', () => {
    if (articleList.length === 0) return callback(null, { status: 'success', link: link })
    const debugInfo = logicType === 'init' ? undefined : debugFeeds
    processSources({ articleList: articleList, debugFeeds: debugInfo, shardId: storage.bot.shard ? storage.bot.shard.id : undefined, ...data }, (err, results) => {
      if (err) {
        if (logicType === 'init') throw err
        else if (logicType === 'cycle') log.cycle.error(`Cycle logic`, err, true)
      }
      if (results) callback(null, results)
    })
  })
}

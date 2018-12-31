const requestStream = require('./request.js')
const DecodedFeedParser = require('../structs/DecodedFeedParser.js')
const processSources = require('./logic/shared.js')
const debugFeeds = require('../util/debugFeeds').list
const log = require('../util/logger.js')
const storage = require('../util/storage.js')

module.exports = (data, callback) => {
  const { link, rssList, uniqueSettings, scheduleName } = data
  const feedparser = new DecodedFeedParser(null, link)
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
    processSources({ articleList: articleList, debugFeeds: debugFeeds, shardId: storage.bot.shard ? storage.bot.shard.id : undefined, scheduleName, ...data }, (err, results) => {
      if (err) log.cycle.error(`Cycle logic`, err, true)
      if (results) callback(null, results)
    })
  })
}

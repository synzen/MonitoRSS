const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const initAllSources = require('./logic/shared.js')
const debugFeeds = require('../util/debugFeeds').list
const log = require('../util/logger.js')

module.exports = (data, callback) => {
  if (process.env.initializing !== 'true' && process.env.initializing !== 'false') throw new Error(`Expected environment variable for singleMethod process.env.initializing to be "true" or "false", found ${process.env.initializing} instead`)
  const { link, rssList, uniqueSettings } = data
  const feedparser = new FeedParser()
  const articleList = []

  const cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, err => {
    if (err) callback(err, { status: 'failed', link: link, rssList: rssList })
  })

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
    const debugInfo = process.env.initializing === 'true' ? undefined : debugFeeds
    initAllSources({ articleList: articleList, debugFeeds: debugInfo, ...data }, (err, results) => {
      if (err) {
        if (process.env.initializing === 'true') throw err
        else if (process.env.initializing === 'false') log.cycle.error(`Cycle logic`, err)
      }
      if (results) callback(null, results)
    })
  })
}

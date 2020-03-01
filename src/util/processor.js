const logLinkErrs = require('../config.js').log.linkErrs
const connectDb = require('../util/connectDatabase.js')
const createLogger = require('./logger/create.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const RequestError = require('../structs/errors/RequestError.js')
const FeedParserError = require('../structs/errors/FeedParserError.js')
const LinkLogic = require('../structs/LinkLogic.js')
const debug = require('../util/debugFeeds.js')
const DataDebugger = require('../structs/DataDebugger.js')
const databaseFuncs = require('../util/database.js')
const config = require('../config.js')

async function fetchFeed (headers, url, log) {
  if (log) {
    log.info(`Fetching URL`)
  }
  const fetchOptions = {}
  if (headers) {
    if (!headers.lastModified || !headers.etag) {
      throw new Error(`Headers exist for a link, but missing lastModified and etag (${url})`)
    }
    fetchOptions.headers = {
      'If-Modified-Since': headers.lastModified,
      'If-None-Match': headers.etag
    }
  }
  const { stream, response } = await FeedFetcher.fetchURL(url, fetchOptions)
  if (response.status === 304) {
    if (log) {
      log.info(`304 response, sending success status`)
    }
    return null
  } else {
    const lastModified = response.headers['last-modified']
    const etag = response.headers['etag']

    if (lastModified && etag) {
      process.send({
        status: 'headers',
        link: url,
        lastModified,
        etag
      })
      if (log) {
        log.info(`Sending back headers`)
      }
    }
    return stream
  }
}

async function parseStream (stream, url, log) {
  if (log) {
    log.info(`Parsing stream`)
  }
  const { articleList } = await FeedFetcher.parseStream(stream, url)
  if (articleList.length === 0) {
    if (log) {
      log.info(`No articles found, sending success status`)
    }
    return null
  }
  return articleList
}

async function syncDatabase (articleList, databaseDocs, feeds, meta, memoryCollection) {
  const allComparisons = new Set()
  for (const feedID in feeds) {
    const feed = feeds[feedID]
    feed.ncomparisons.forEach(v => allComparisons.add(v))
    feed.pcomparisons.forEach(v => allComparisons.add(v))
  }
  const {
    toInsert,
    toUpdate
  } = await databaseFuncs.getInsertsAndUpdates(
    articleList,
    databaseDocs,
    Array.from(allComparisons),
    meta
  )

  await databaseFuncs.insertDocuments(toInsert, memoryCollection)
  await databaseFuncs.updateDocuments(toUpdate, memoryCollection)
}

async function getFeed (data, log) {
  const { link, rssList, headers, toDebug, docs, feedData, scheduleName, runNum } = data
  const urlLog = toDebug ? log.child({
    url: link
  }) : null
  if (urlLog) {
    urlLog.info(`Isolated processor received in batch`)
  }
  try {
    const stream = await fetchFeed(headers[link], link, urlLog)
    if (!stream) {
      process.send({ status: 'success', link })
      return
    }
    const articleList = await parseStream(stream, link, urlLog)
    if (!articleList) {
      process.send({ status: 'success', link })
      return
    }
    // Sync first
    const meta = {
      feedURL: link,
      scheduleName
    }
    await syncDatabase(articleList, docs, rssList, meta, feedData)

    if (runNum !== 0 || config.feeds.sendFirstCycle === true) {
      // Then send to prevent new article spam if sync fails
      const logic = new LinkLogic({ articleList, ...data })
      const result = await logic.run(docs)
      const newArticles = result.newArticles
      const length = newArticles.length
      for (let i = 0; i < length; ++i) {
        if (urlLog) {
          urlLog.info(`Sending article status`)
        }
        process.send({
          status: 'article',
          article: newArticles[i]
        })
      }
    }

    process.send({
      status: 'success',
      link,
      memoryCollection: feedData
    })
  } catch (err) {
    if (urlLog) {
      urlLog.info(`Sending failed status`)
    }
    process.send({ status: 'failed', link, rssList })
    if (err instanceof RequestError || err instanceof FeedParserError) {
      if (logLinkErrs) {
        log.warn({
          error: err
        }, `Skipping ${link}`)
      }
    } else {
      log.error(err, `Cycle logic`)
    }
  }
}

process.on('message', async m => {
  const currentBatch = m.currentBatch
  const { debugFeeds, debugLinks, scheduleName, feedData } = m
  debug.feeds = new DataDebugger(debugFeeds || [], 'feeds-processor')
  debug.links = new DataDebugger(debugLinks || [], 'links-processor')
  const logMarker = scheduleName
  const log = createLogger(logMarker)
  try {
    await connectDb(logMarker, true)
    const articleDocuments = await databaseFuncs.getAllDocuments(scheduleName, feedData)
    const promises = []
    for (const link in currentBatch) {
      const docs = articleDocuments[link] || []
      const rssList = currentBatch[link]
      const toDebug = debug.links.has(link)
      promises.push(getFeed({ ...m, link, toDebug, rssList, docs }, log))
    }
    await Promise.all(promises)
    process.exit()
  } catch (err) {
    log.error(err, `processor`)
  }
})

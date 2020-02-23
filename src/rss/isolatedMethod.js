const logLinkErrs = require('../config.js').log.linkErrs
const connectDb = require('./db/connect.js')
const log = require('../util/logger.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const RequestError = require('../structs/errors/RequestError.js')
const FeedParserError = require('../structs/errors/FeedParserError.js')
const LinkLogic = require('./logic/LinkLogic.js')
const debug = require('../util/debugFeeds.js')
const DataDebugger = require('../structs/DataDebugger.js')
const databaseFuncs = require('./database.js')

async function fetchFeed (headers, url, debug) {
  if (debug) {
    log.debug.info(`${url}: Fetching URL`)
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
    if (debug) {
      log.debug.info(`${url}: 304 response, sending success status`)
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
      if (debug) {
        log.debug.info(`${url}: Sending back headers`)
      }
    }
    return stream
  }
}

async function parseStream (stream, url, debug) {
  if (debug) {
    log.debug.info(`${url}: Parsing stream`)
  }
  const { articleList } = await FeedFetcher.parseStream(stream, url)
  if (articleList.length === 0) {
    if (debug) {
      log.debug.info(`${url}: No articles found, sending success status`)
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

async function getFeed (data) {
  const { link, rssList, headers, toDebug, docs, feedData, shardID, scheduleName } = data
  try {
    const stream = await fetchFeed(headers[link], link, toDebug)
    if (!stream) {
      process.send({ status: 'success', link })
      return
    }
    const articleList = await parseStream(stream, link, toDebug)
    if (!articleList) {
      process.send({ status: 'success', link })
      return
    }
    // Sync first
    const meta = {
      feedURL: link,
      shardID,
      scheduleName
    }
    await syncDatabase(articleList, docs, rssList, meta, feedData)

    // Then send to prevent new article spam if sync fails
    const logic = new LinkLogic({ articleList, ...data })
    const result = await logic.run(docs)
    const newArticles = result.newArticles
    const length = newArticles.length
    for (let i = 0; i < length; ++i) {
      if (toDebug) {
        log.debug.info(`${link}: Sending article status`)
      }
      process.send({
        status: 'article',
        article: newArticles[i]
      })
    }
    process.send({
      status: 'success',
      link,
      memoryCollection: feedData
    })
  } catch (err) {
    if (toDebug) {
      log.debug.info(`${link}: Sending failed status`)
    }
    process.send({ status: 'failed', link, rssList })
    if (err instanceof RequestError || err instanceof FeedParserError) {
      if (logLinkErrs || toDebug) {
        log.cycle.warning(`Skipping ${link}`, err)
      }
    } else {
      log.cycle.error(`Cycle logic (${link})`, err, true)
    }
  }
}

process.on('message', async m => {
  const currentBatch = m.currentBatch
  const { debugFeeds, debugLinks, scheduleName, shardID, feedData } = m
  debug.feeds = new DataDebugger(debugFeeds || [], 'feeds-processor')
  debug.links = new DataDebugger(debugLinks || [], 'links-processor')
  try {
    await connectDb(true)
    const articleDocuments = await databaseFuncs.getAllDocuments(shardID, scheduleName, feedData)
    const promises = []
    for (const link in currentBatch) {
      const docs = articleDocuments[link] || []
      const toDebug = debug.links.has(link)
      if (toDebug) {
        log.debug.info(`${link}: Isolated processor received link in batch`)
      }
      const rssList = currentBatch[link]
      promises.push(getFeed({ ...m, link, rssList, toDebug, docs }))
    }
    await Promise.all(promises)
    process.exit()
  } catch (err) {
    log.general.error(`isolatedMethod`, err)
  }
})

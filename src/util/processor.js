const connectDb = require('../util/connectDatabase.js')
const createLogger = require('./logger/create.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const RequestError = require('../structs/errors/RequestError.js')
const FeedParserError = require('../structs/errors/FeedParserError.js')
const LinkLogic = require('../structs/LinkLogic.js')
const initialize = require('../initialization/index.js')
const databaseFuncs = require('../util/database.js')
const devLevels = require('./devLevels.js')

async function fetchFeed (headers, url, urlLog) {
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
    return null
  } else {
    const lastModified = response.headers['last-modified']
    const etag = response.headers.etag

    if (lastModified && etag) {
      process.send({
        status: 'headers',
        link: url,
        lastModified,
        etag
      })
      urlLog('Sending back headers')
    }
    return {
      stream,
      response
    }
  }
}

async function parseStream (stream, charset, url, urlLog) {
  const { articleList } = await FeedFetcher.parseStream(stream, url, charset)
  return articleList
}

async function syncDatabase (articleList, databaseDocs, feeds, meta, isDatabaseless) {
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

  const memoryCollection = isDatabaseless ? databaseDocs : undefined
  await databaseFuncs.insertDocuments(toInsert, memoryCollection)
  await databaseFuncs.updateDocuments(toUpdate, memoryCollection)
}

/**
 * @param {import('../structs/NewArticle.js')[]} newArticles
 * @param {import('pino').Logger} log
 */
async function sendArticles (newArticles) {
  const len = newArticles.length
  for (var i = 0; i < len; ++i) {
    const newArticle = newArticles[i]
    process.send({
      status: 'newArticle',
      newArticle: newArticle.toJSON()
    })
  }
}

async function getFeed (data, log) {
  const { link, rssList, headers, toDebug, docs, memoryCollections, scheduleName, runNum, config, testRun } = data
  const isDatabaseless = !!memoryCollections
  const debugLogger = log.child({
    url: link
  })
  const urlLog = toDebug ? debugLogger.info.bind(debugLogger) : () => {}
  urlLog('Isolated processor received in batch')

  let articleList
  try {
    // Request URL
    urlLog('Requesting url')
    const fetchData = await fetchFeed(headers[link], link, urlLog)
    if (!fetchData) {
      urlLog('304 response, sending success')
      process.send({ status: 'connected' })
      process.send({ status: 'success', link })
      return
    }
    // Parse feed
    const { stream, response } = fetchData
    const charset = FeedFetcher.getCharsetFromResponse(response)
    urlLog(`Parsing stream with ${charset} charset`)
    articleList = await parseStream(stream, charset, link, urlLog)
    process.send({ status: 'connected' })
    if (articleList.length === 0) {
      urlLog('No articles found, sending success')
      process.send({ status: 'success', link })
      return
    }
  } catch (err) {
    if (!(err instanceof RequestError) && !(err instanceof FeedParserError)) {
      log.error(err, 'URL connection')
    } else if (config.log.linkErrs) {
      log.warn({ error: err }, `Skipping ${link}`)
    }
    urlLog({ error: err }, 'Sending failed status during connection')
    process.send({ status: 'connected' })
    process.send({ status: 'failed', link, rssList, reason: err.message })
    return
  }

  if (testRun || devLevels.disableCycleDatabase(config)) {
    return process.send({
      status: 'success',
      link
    })
  }

  // Go through articles
  try {
    /**
     * Run the logic to get any new articles before syncDatabase modifies
     * databaseless memory collections in-place
     *
     * Any new n/p comparisons are also delayed by 1 cycle since docs
     * are fetched before getFeed (before they're updated below this)
     */
    const logic = new LinkLogic({ articleList, ...data })
    const result = await logic.run(docs)
    /**
     * @type {import('../structs/NewArticle.js')[]}
     */
    const newArticles = result.newArticles

    /**
     * Then sync the database
     */
    const meta = {
      feedURL: link,
      scheduleName
    }
    await syncDatabase(articleList, docs, rssList, meta, isDatabaseless)

    /**
     * Then finally send new articles to prevent spam if sync fails
     */
    if (runNum !== 0 || config.feeds.sendFirstCycle === true) {
      urlLog(`${newArticles.length} new articles found`)
      await sendArticles(newArticles)
    }

    process.send({
      status: 'success',
      link,
      memoryCollection: isDatabaseless ? docs : undefined
    })
  } catch (err) {
    log.error(err, `Cycle logic for ${link}`)
    process.send({ status: 'failed', link, rssList, reason: err.message })
  }
}

async function connectToDatabase (config) {
  if (!config.database.uri.startsWith('mongo')) {
    return
  }
  const connection = await connectDb(config.database.uri, config.database.connection)
  await initialize.setupModels(connection)
}

process.on('message', async m => {
  const currentBatch = m.currentBatch
  const { debugURLs, scheduleName, memoryCollections, config } = m
  const logMarker = scheduleName
  const log = createLogger(logMarker)
  const urls = Object.keys(currentBatch)
  try {
    await connectToDatabase(config)
    const articleDocuments = await databaseFuncs.getAllDocuments(scheduleName, memoryCollections, urls)
    const promises = []
    for (var link in currentBatch) {
      const docs = articleDocuments[link] || []
      const rssList = currentBatch[link]
      const toDebug = debugURLs.includes(link)
      promises.push(getFeed({ ...m, link, toDebug, rssList, docs }, log))
    }
    await Promise.all(promises)
  } catch (err) {
    log.error(err, 'processor')
  }
})

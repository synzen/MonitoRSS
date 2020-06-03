const EventEmitter = require('events').EventEmitter
const Schedule = require('./db/Schedule.js')
const FailRecord = require('./db/FailRecord.js')
const Feed = require('./db/Feed.js')
const Supporter = require('./db/Supporter.js')
const ScheduleStats = require('./db/ScheduleStats.js')
const ProcessorPool = require('./ProcessorPool.js')
const promisify = require('util').promisify
const maintenance = require('../maintenance/index.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

/**
 * @typedef {string} FeedID
 */

/**
 * @typedef {string} FeedURL
 */

/**
 * @typedef {Object<string, any>} FeedObject
 */

/**
 * With a large number of feeds, Promise.all will cause hangups
 * for some inexplicable reason. This implementation fixes that.
 *
 * @param {Promise[]} promises
 */
async function promiseAll (promises) {
  return new Promise((resolve, reject) => {
    const completed = promises.map((p) => false)
    for (let i = 0; i < promises.length; ++i) {
      const promise = promises[i]
      promise.then(() => {
        completed[i] = true
        if (!completed.find(complete => !complete)) {
          resolve()
        }
      }).catch(reject)
    }
  })
}

class ScheduleRun extends EventEmitter {
  /**
   * @param {import('./db/Schedule.js')} schedule
   * @param {number} runCount
   * @param {Object<string, any>} memoryCollections
   */
  constructor (schedule, runCount, testRun = false) {
    if (!schedule.refreshRateMinutes) {
      throw new Error('No refreshRateMinutes has been declared for a schedule')
    }
    if (schedule.name !== 'default' && schedule.name !== Supporter.schedule.name && schedule.keywords.length === 0 && schedule.feeds.length === 0) {
      throw new Error(`Cannot create a ScheduleRun with invalid/empty keywords array for nondefault schedule (name: ${schedule.name})`)
    }
    super()
    this.name = schedule.name
    this.schedule = schedule
    this.log = createLogger(this.name)
    this.processorPool = new ProcessorPool(this.name)
    /**
     * @type {Set<string>[][]}
    */
    this.urlBatchGroups = []
    /**
     * @type {number[][]}
    */
    this.urlSizeGroups = []
    /**
     * @type {Set<string>}
     */
    this.failedURLs = new Set()
    this.succeededURLs = new Set()
    this._cycleTotalCount = 0
    this.feedCount = 0 // For statistics
    this.ran = runCount // # of times this schedule has ran
    if (!ScheduleRun.headers.has(schedule)) {
      ScheduleRun.headers.set(schedule, {})
    }
    this.headers = ScheduleRun.headers.get(schedule)
    if (!Schedule.isMongoDatabase && !ScheduleRun.memoryCollections.has(schedule)) {
      ScheduleRun.memoryCollections.set(schedule, {})
    }
    // ONLY FOR DATABASELESS USE. Object of collection ids as keys, and arrays of objects (AKA articles) as values
    this.memoryCollections = ScheduleRun.memoryCollections.get(schedule)
    this.testRun = testRun
  }

  /**
   * @param {import('./db/Feed.js')[]} feeds
   * @param {Set<string>} debugFeedIDs
   */
  getDebugURLs (feeds, debugFeedIDs) {
    const debugFeedURLs = new Set()
    if (debugFeedIDs.size === 0) {
      return debugFeedURLs
    }
    const mappedURLs = new Map()
    for (var i = feeds.length - 1; i >= 0; --i) {
      const feed = feeds[i]
      mappedURLs.set(feed._id, feed.url)
    }
    debugFeedIDs.forEach((feedID) => {
      if (mappedURLs.has(feedID)) {
        debugFeedURLs.add(mappedURLs.get(feedID))
      }
    })
    return debugFeedURLs
  }

  getProcessor () {
    const processor = this.processorPool.get()
    return processor
  }

  /**
   * @param {import('./Processor.js')} processor
   */
  killProcessor (processor) {
    this.processorPool.kill(processor)
  }

  killAllProcessors () {
    this.processorPool.killAll()
  }

  /**
   * @param {import('./db/Feed.js')[]} feeds
   */
  async updateFeedsStatus (feeds) {
    if (this.testRun) {
      return
    }
    const { enabled, disabled } = await maintenance.checkLimits.limits(feeds)
    enabled.forEach(feed => this.emit('feedEnabled', feed))
    disabled.forEach(feed => this.emit('feedDisabled', feed))
  }

  /**
   * @param {import('./db/Feed.js')[]} feeds
   */
  async getFailRecordsMap (feeds) {
    const urls = new Set()
    for (var i = feeds.length - 1; i >= 0; --i) {
      urls.add(feeds[i].url)
    }
    const failRecords = await FailRecord.getManyByQuery({
      _id: {
        $in: Array.from(urls)
      }
    })
    const failRecordsMap = new Map()
    for (const record of failRecords) {
      failRecordsMap.set(record._id, record)
    }
    return failRecordsMap
  }

  /**
   * @param {Map<string, import('./db/FailRecord.js')} failRecordMap
   */
  alertFailRecords (failRecordMap) {
    failRecordMap.forEach(record => {
      if (record.hasFailed() && !record.alerted) {
        this.emit('alertFail', record)
      }
    })
  }

  /**
   * Get the feeds that belong to this schedule
   * @param {import('./db/Feed.js')[]} feeds
   */
  async getScheduleFeeds (feeds) {
    const [schedules, supporterGuilds] = await Promise.all([
      Schedule.getAll(),
      Supporter.getValidGuilds()
    ])
    const feedsLength = feeds.length
    const schedulesToFetch = []
    for (var h = 0; h < feedsLength; ++h) {
      const feed = feeds[h]
      schedulesToFetch.push(feed.determineSchedule(schedules, supporterGuilds))
    }
    this.log.debug(`Determing schedules of ${schedulesToFetch.length} feeds`)
    const determinedSchedules = await Promise.all(schedulesToFetch)
    /**
     * @type {import('./db/Feed.js')[]}
     */
    const filtered = []
    for (var i = 0; i < feedsLength; ++i) {
      const feed = feeds[i]
      const name = determinedSchedules[i].name
      // Match schedule
      if (this.name !== name) {
        continue
      }
      filtered.push(feed)
    }
    return filtered
  }

  /**
   * Get the feeds that belong to this schedule
   * @param {import('./db/Feed.js')[]} feeds
   * @param {Map<string, FailRecord>} failRecordsMap
   * @param {Set<string>} debugFeedIDs
   */
  async getEligibleFeeds (feeds, failRecordsMap, debugFeedIDs) {
    // Modifies the feeds in-place
    await this.updateFeedsStatus(feeds)
    const feedsLength = feeds.length
    /**
     * @type {import('./db/Feed.js')[]}
     */
    const filtered = []
    for (var i = 0; i < feedsLength; ++i) {
      const feed = feeds[i]
      if (!this.isEligibleFeed(feed, failRecordsMap, debugFeedIDs)) {
        continue
      }
      filtered.push(feed)
    }
    return filtered
  }

  /**
   * Feeds must be be JSON for IPC
   * @param {import('./db/Feed.js')[]} feeds
   */
  convertFeedsToJSON (feeds) {
    const converted = []
    const feedsLength = feeds.length
    for (var i = 0; i < feedsLength; ++i) {
      converted.push(feeds[i].toJSON())
    }
    return converted
  }

  /**
   * @param {import('./db/Feed.js')} feed
   * @param {Map<string, FailRecord>} failRecordsMap
   * @param {Set<string>} debugFeedIDs
   */
  isEligibleFeed (feed, failRecordsMap, debugFeedIDs) {
    const toDebug = debugFeedIDs.has(feed._id)
    const debugLog = toDebug ? m => this.log.info(`${feed._id} ${m}`) : () => {}
    /** @type {FailRecord} */
    if (feed.disabled) {
      debugLog('Skipping feed delegation due to disabled status')
      return false
    }
    const failRecord = failRecordsMap.get(feed.url)
    if (failRecord && failRecord.hasFailed()) {
      debugLog(`Skipping feed delegation, failed status: ${failRecord.hasFailed()}, alerted: ${failRecord.alerted}`)
      return false
    }
    debugLog('Preparing for feed delegation')
    return true
  }

  /**
   * @typedef {Object<FeedID, FeedObject>} FeedByIDs
   */

  /**
   * @typedef {Map<FeedURL, FeedByIDs>} URLMap
   */

  /**
   * @param {Object<string, any>[]} feedObjects
   * @param {Set<string>} debugFeedIDs
   * @returns {URLMap}
   */
  mapFeedsByURL (feedObjects, debugFeedIDs) {
    const map = new Map()
    for (var i = feedObjects.length - 1; i >= 0; --i) {
      const feedObject = feedObjects[i]

      if (this.memoryCollections && !this.memoryCollections[feedObject.url]) {
        this.memoryCollections[feedObject.url] = []
      }

      const debug = debugFeedIDs.has(feedObject._id)
      const debugLog = debug ? m => this.log.info(`${feedObject._id} ${m}`) : () => {}

      // Each item in the map has a unique URL, with every source with this the same link aggregated below it
      if (map.has(feedObject.url)) {
        const urlMap = map.get(feedObject.url)
        urlMap[feedObject._id] = feedObject
        debugLog('Adding to pre-existing source list')
      } else {
        const urlMap = {}
        urlMap[feedObject._id] = feedObject
        map.set(feedObject.url, urlMap)
        debugLog('Creating new source list')
      }
    }
    return map
  }

  /**
   * @typedef {Object<FeedURL, FeedByIDs>} URLBatch
   */

  /**
   * @param {URLMap} urlMap
   * @param {number} batchSize
   * @param {Set<string>} debugFeedURLs
   * @returns {URLBatch[]}
   */
  createBatches (urlMap, batchSize, debugFeedURLs) {
    const batches = []
    let batch = {}
    urlMap.forEach((feedByIDs, url) => {
      if (Object.keys(batch).length >= batchSize) {
        batches.push(batch)
        batch = {}
      }
      batch[url] = feedByIDs
      if (debugFeedURLs.has(url)) {
        this.log.info(`${url}: Attached URL to regular batch list for ${this.name}`)
      }
    })

    if (Object.keys(batch).length > 0) {
      batches.push(batch)
    }
    this.batches = batches
    this.createURLRecords(this.batches)
    return batches
  }

  /**
   * Create records to track what URLs responded within
   * this run, and which hung up. Initially store them,
   * and wait for them to be removed
   *
   * @param {URLBatch[]} batches
   */
  createURLRecords (batches) {
    const urlBatchRecords = batches.map(batch => new Set(Object.keys(batch)))
    const urlSizeRecords = urlBatchRecords.map(batch => batch.size)
    this.urlBatchRecords = urlBatchRecords
    this.urlSizeRecords = urlSizeRecords
  }

  /**
   * Mark a URL as "responded" by removing it from records
   *
   * @param {number} groupIndex
   * @param {number} batchIndex
   * @param {string} url
   */
  removeFromBatchRecords (batchIndex, url) {
    const urlBatch = this.urlBatchRecords[batchIndex]
    urlBatch.delete(url)
  }

  getHungUpURLs () {
    const summary = this.urlBatchRecords.filter((urlBatch, batchIndex) => {
      const origBatchSize = this.urlSizeRecords[batchIndex]
      /**
         * If equal to original batch size, none of the URLs were completed
         * If equal to 0, all of them were completed
         *
         * This summary does not show a batch if it was hung up on all URLs
         */
      const someCompleted = urlBatch.size < origBatchSize && urlBatch.size > 0
      return someCompleted
    }).map((urlBatch) => Array.from(urlBatch))
    const remaining = this.urlBatchRecords.map(b => b.size)
    const total = remaining.reduce((total, cur) => total + cur, 0)
    return {
      summary,
      remaining,
      total
    }
  }

  /**
   * @param {Set<string>} debugFeedIDs
   */
  async run (debugFeedIDs) {
    this._startTime = new Date()
    const config = getConfig()
    this.log.debug({
      schedule: this.schedule
    }, '1 Running schedule, getting all feeds')
    const feeds = await Feed.getAll()
    // Check the limits
    this.log.debug(`2 Fetched all feeds (${feeds.length}), getting feeds of this schedule`)
    // Get eligible feeds of this schedule
    const scheduleFeeds = await this.getScheduleFeeds(feeds)
    this.log.debug('3 Got feeds of this schedule, getting fail record map')
    const failRecordsMap = await this.getFailRecordsMap(scheduleFeeds)
    this.alertFailRecords(failRecordsMap)
    this.log.debug('4 Got fail record map, getting elgibile feeds')
    const eligibleFeeds = await this.getEligibleFeeds(scheduleFeeds, failRecordsMap, debugFeedIDs)
    this.log.debug(`5 Got eligibile feeds (${eligibleFeeds.length}/${scheduleFeeds.length}/${feeds.length}), converting all to JSON`)
    const feedObjects = this.convertFeedsToJSON(eligibleFeeds)
    this.log.debug(`6 Fetched applicable feeds (${feedObjects.length}), mapping feeds by URL`)
    this.feedCount = feedObjects.length
    // Put all feeds with the same URLs together
    const urlMap = this.mapFeedsByURL(feedObjects, debugFeedIDs)
    this.log.debug(`7 Mapped feeds by URL (${urlMap.size} URLs), creating batches`)
    if (urlMap.size === 0) {
      return this.finishNoFeedsCycle()
    }
    // Batch them up
    const debugFeedURLs = this.getDebugURLs(feeds, debugFeedIDs)
    const batches = this.createBatches(urlMap, config.advanced.batchSize, debugFeedURLs)
    this.batches = batches
    this.log.debug(`8 Created ${batches.length} batches`)
    const processBatch = promisify(this.processBatch).bind(this)
    const processing = []
    const parallelBatches = config.advanced.parallelBatches
    const spawn = batches.length <= parallelBatches ? batches.length : parallelBatches
    const batchStatuses = this.batches.map((b, index) => 0)
    for (let i = 0; i < spawn; ++i) {
      this.log.debug(`[START] Starting processor ${i + 1}/${spawn}`)
      processing.push(processBatch(batches, i, batchStatuses, debugFeedIDs, debugFeedURLs))
    }
    await promiseAll(processing)
    await this.finishFeedsCycle()
  }

  createMessageHandler (batches, batchIndex, debugFeedURLs, onAllConnected, onComplete) {
    const thisBatch = batches[batchIndex]
    const batchLength = Object.keys(thisBatch).length
    let connectedLinks = 0
    let completedLinks = 0
    let thisFailures = 0

    return linkCompletion => {
      const { link, status, lastModified, etag, memoryCollection, newArticle } = linkCompletion
      const debugLog = debugFeedURLs.has(link) ? m => this.log.info({ url: link, status }, m) : () => {}
      if (status === 'headers') {
        this.headers[link] = {
          lastModified,
          etag
        }
        return
      }
      if (status === 'connected') {
        ++connectedLinks
        debugLog('Link connected from processor')
        if (connectedLinks === batchLength) {
          onAllConnected()
        }
        return
      }
      if (status === 'newArticle') {
        return this.emit('newArticle', newArticle)
      }
      if (status === 'failed') {
        ++thisFailures
        this.failedURLs.add(link)
        this.emit('conFailure', link, linkCompletion.reason)
      } else if (status === 'success') {
        this.emit('conSuccess', link)
        if (memoryCollection) {
          this.memoryCollections[link] = memoryCollection
        }
      }

      ++this._cycleTotalCount
      ++completedLinks
      this.removeFromBatchRecords(batchIndex, link)
      this.log.trace(`[BATCH ${batchIndex + 1}/${batches.length}] URLs Completed: ${completedLinks}/${batchLength}`)
      debugLog('Link completed from processor')
      if (completedLinks === batchLength) {
        onComplete(thisFailures)
      }
    }
  }

  processBatch (batches, batchIndex, batchStatuses, debugFeedIDs, debugFeedURLs, onBatchesComplete) {
    batchStatuses[batchIndex] = 1
    const thisBatch = batches[batchIndex]
    const thisBatchLength = Object.keys(thisBatch).length
    const processor = this.getProcessor()
    this.log.debug(`Batch ${batchIndex + 1}/${this.batches.length} starting. Processors in use: ${this.processorPool.pool.length}`)
    const onAllConnected = () => {
      this.log.debug(`Batch ${batchIndex + 1}/${this.batches.length} connected`)
      for (let i = 0; i < batchStatuses.length; ++i) {
        const status = batchStatuses[i]
        if (status === 0) {
          return this.processBatch(batches, i, batchStatuses, debugFeedIDs, debugFeedURLs, onBatchesComplete)
        }
      }
    }
    const onComplete = (failures) => {
      batchStatuses[batchIndex] = 2
      this.killProcessor(processor)
      this.log.debug(`Batch ${batchIndex + 1}/${this.batches.length} completed (${failures} failed/${thisBatchLength})`)
      if (!batchStatuses.find(status => status !== 2)) {
        onBatchesComplete()
      }
    }
    const handler = this.createMessageHandler(batches, batchIndex, debugFeedURLs, onAllConnected, onComplete)
    processor.on('message', handler.bind(this))
    processor.send({
      config: getConfig(),
      currentBatch: thisBatch,
      debugFeeds: Array.from(debugFeedIDs),
      debugURLs: Array.from(debugFeedURLs),
      headers: this.headers,
      memoryCollections: this.memoryCollections,
      runNum: this.ran,
      scheduleName: this.name,
      testRun: this.testRun
    })
  }

  terminate () {
    this.removeAllListeners()
    this.killAllProcessors()
  }

  finishNoFeedsCycle () {
    const nameParen = this.name !== 'default' ? ` (${this.name})` : ''
    this.killAllProcessors()
    this.log.info(`Finished feed retrieval cycle${nameParen}. No feeds to retrieve`)
  }

  async finishFeedsCycle () {
    const cycleTime = (new Date() - this._startTime) / 1000
    await this.updateStats(cycleTime)
    const timeTaken = cycleTime.toFixed(2)
    const nameParen = this.name !== 'default' ? ` (${this.name})` : ''
    const count = this.failedURLs.size > 0 ? ` (${this.failedURLs.size}/${this._cycleTotalCount} failed)` : ` (${this._cycleTotalCount})`
    this.killAllProcessors()
    this.log.info(`Finished feed retrieval cycle${nameParen}${count}. Cycle Time: ${timeTaken}s`)
  }

  async updateStats (cycleTime) {
    if (this.testRun) {
      return
    }
    try {
      const stats = await ScheduleStats.get(this.name)
      const data = {
        _id: this.name,
        feeds: this.feedCount,
        cycleTime,
        cycleFails: this.failedURLs.size,
        cycleURLs: this._cycleTotalCount,
        lastUpdated: new Date().toISOString()
      }
      if (!stats) {
        const newStats = new ScheduleStats(data)
        return newStats.save()
      } else {
        stats.feeds = data.feeds
        stats.cycleTime = Math.round((data.cycleTime + stats.cycleTime) / 2)
        stats.cycleFails = Math.round((data.cycleFails + stats.cycleFails) / 2)
        stats.cycleURLs = data.cycleURLs
        stats.lastUpdated = data.lastUpdated
        return stats.save()
      }
    } catch (err) {
      this.log.error(err, 'Unable to update statistics after cycle')
    }
  }
}

/**
 * @type {Map<import('./db/Schedule.js'), Object<string, any>>}
 */
ScheduleRun.headers = new Map()

/**
 * @type {Map<import('./db/Schedule.js'), Object<string, any>>}
 */
ScheduleRun.memoryCollections = new Map()

module.exports = ScheduleRun

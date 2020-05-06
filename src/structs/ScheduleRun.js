const EventEmitter = require('events').EventEmitter
const Schedule = require('./db/Schedule.js')
const FailRecord = require('./db/FailRecord.js')
const Feed = require('./db/Feed.js')
const Supporter = require('./db/Supporter.js')
const ScheduleStats = require('./db/ScheduleStats.js')
const Processor = require('./Processor.js')
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

class ScheduleRun extends EventEmitter {
  /**
   * @param {import('./db/Schedule.js')} schedule
   * @param {number} runCount
   * @param {Object<string, any>} memoryCollections
   */
  constructor (schedule, runCount, memoryCollections, headers) {
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
    this._processorList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    // ONLY FOR DATABASELESS USE. Object of collection ids as keys, and arrays of objects (AKA articles) as values
    this.memoryCollections = memoryCollections
    this.feedCount = 0 // For statistics
    this.ran = runCount // # of times this schedule has ran
    this.headers = headers
  }

  async getFailRecordMap () {
    const failRecords = await FailRecord.getAll()
    const failRecordMap = new Map()
    for (const record of failRecords) {
      failRecordMap.set(record.url, record)
    }
    return failRecordMap
  }

  /**
   * Get the feeds that belong to this schedule
   * @param {import('./db/Feed.js')[]} feeds
   * @param {Map<string, FailRecord>} failRecordsMap
   * @param {Set<string>} debugFeedIDs
   */
  async getApplicableFeeds (feeds, failRecordsMap, debugFeedIDs) {
    const [schedules, supporterGuilds] = await Promise.all([
      Schedule.getAll(),
      Supporter.getValidGuilds()
    ])
    const schedulesToFetch = []
    for (var h = feeds.length - 1; h >= 0; --h) {
      const feed = feeds[h]
      schedulesToFetch.push(feed.determineSchedule(schedules, supporterGuilds))
    }
    this.log.debug(`Determing schedules of ${schedulesToFetch.length} feeds`)
    const determinedSchedules = await Promise.all(schedulesToFetch)
    const jsons = []
    for (var i = feeds.length - 1; i >= 0; --i) {
      const feed = feeds[i]
      const name = determinedSchedules[i].name
      // Match schedule
      if (this.name !== name) {
        continue
      }
      if (!this.isEligibleFeed(feed, failRecordsMap, debugFeedIDs)) {
        continue
      }
      jsons.push(feed.toJSON())
    }
    return jsons
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

  /**
   * @param {Object<string, any>} feedObjects
   * @param {Map<string, FailRecord>} failRecordsMap
   * @param {Set<string>} debugFeedIDs
   */
  isEligibleFeed (feedObjects, failRecordsMap, debugFeedIDs) {
    const toDebug = debugFeedIDs.has(feedObjects._id)
    /** @type {FailRecord} */
    if (feedObjects.disabled) {
      if (toDebug) {
        this.log.info(`${feedObjects._id}: Skipping feed delegation due to disabled status`)
      }
      return false
    }
    const failRecord = failRecordsMap.get(feedObjects.url)
    if (failRecord && (failRecord.hasFailed() && failRecord.alerted)) {
      if (toDebug) {
        this.log.info(`${feedObjects._id}: Skipping feed delegation, failed status: ${failRecord.hasFailed()}, alerted: ${failRecord.alerted}`)
      }
      return false
    }
    if (toDebug) {
      this.log.info(`${feedObjects._id}: Preparing for feed delegation`)
    }
    return true
  }

  /**
   * @typedef {Object<FeedID, FeedObject>} FeedByIDs
   */

  /**
   * @typedef {Map<FeedURL, FeedByIDs>} URLMap
   */

  /**
   * @param {Object<string, any>} feedsDatas
   * @param {Set<string>} debugFeedIDs
   * @returns {URLMap}
   */
  mapFeedsByURL (feedDatas, debugFeedIDs) {
    const map = new Map()
    for (var i = feedDatas.length - 1; i >= 0; --i) {
      const feedData = feedDatas[i]

      if (this.memoryCollections && !this.memoryCollections[feedData.url]) {
        this.memoryCollections[feedData.url] = []
      }

      const debug = debugFeedIDs.has(feedData._id)

      // Each item in the map has a unique URL, with every source with this the same link aggregated below it
      if (map.has(feedData.url)) {
        const urlMap = map.get(feedData.url)
        urlMap[feedData._id] = feedData
        if (debug) {
          this.log.info(`${feedData._id}: Adding to pre-existing source list`)
        }
      } else {
        const urlMap = {}
        urlMap[feedData._id] = feedData
        map.set(feedData.url, urlMap)
        if (debug) {
          this.log.info(`${feedData._id}: Creating new source list`)
        }
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
    return batches
  }

  /**
   * @param {URLBatch[]} batches
   * @param {number} groupSize
   */
  createBatchGroups (batches, groupSize) {
    const batchesLength = batches.length
    const groups = []
    const maxPerGroup = Math.ceil(batchesLength / groupSize)
    for (var i = 0; i < batchesLength; i += maxPerGroup) {
      const group = batches.slice(i, i + maxPerGroup)
      groups.push(group)
    }
    return groups
  }

  /**
   * @param {Set<string>} debugFeedIDs
   */
  async run (debugFeedIDs) {
    this._startTime = new Date()
    const config = getConfig()
    this.log.debug({
      schedule: this.schedule
    }, '1/8 Running schedule, getting all feeds')
    const feeds = await Feed.getAll()
    // Check the limits
    this.log.debug('2/8 Fetched all feeds, checking feed limits')
    await maintenance.checkLimits.limits(feeds)
    this.log.debug('3/8 Checked feed limits, getting debug URLs and fail record map')
    const debugFeedURLs = this.getDebugURLs(feeds, debugFeedIDs)
    const failRecordMap = await this.getFailRecordMap()
    this.log.debug('4/8 Created fail records map, getting applicable feeds')
    // Get feed data
    const applicableFeeds = await this.getApplicableFeeds(feeds, failRecordMap, debugFeedIDs)
    this.log.debug('5/8 Fetched relevant feed data, mapping feeds by URL')
    this.feedCount = applicableFeeds.length
    // Put all feeds with the same URLs together
    const urlMap = this.mapFeedsByURL(applicableFeeds, debugFeedIDs)
    this.log.debug('6/8 Mapped feeds by URL, creating batches')
    if (urlMap.size === 0) {
      return this.finishNoFeedsCycle()
    }
    // Batch them up
    const batches = this.createBatches(urlMap, config.advanced.batchSize, debugFeedURLs)
    this.log.debug(`7/8 Created ${batches.length} batches`)
    this.batches = batches
    const batchGroups = this.createBatchGroups(batches, config.advanced.parallelBatches)
    this.log.debug(`8/8 Created ${batchGroups.length} batch groups`)
    this.batchGroups = batchGroups
    let groupsCompleted = 0
    for (let i = 0; i < batchGroups.length; ++i) {
      const group = batchGroups[i]
      this.log.debug(`[GROUPS] Starting batch group ${i + 1}/${batchGroups.length}`)
      this.processBatchGroup(group, 0, debugFeedIDs, debugFeedURLs, () => {
        this.log.debug(`[GROUPS] Finished batch group ${++groupsCompleted}/${batchGroups.length}`)
        if (++groupsCompleted === batchGroups.length) {
          this.finishFeedsCycle()
        }
      })
    }
  }

  createMessageHandler (batchLength, debugFeedURLs, callback) {
    let completedLinks = 0
    return linkCompletion => {
      const { link, status, lastModified, etag, memoryCollection, newArticle } = linkCompletion
      if (status === 'headers') {
        this.headers[link] = {
          lastModified,
          etag
        }
        return
      }
      if (status === 'newArticle') {
        return this.emit('newArticle', newArticle)
      }
      if (status === 'failed') {
        ++this._cycleFailCount
        FailRecord.record(link)
          .catch(err => this.log.error(err, `Unable to record url failure ${link}`))
      } else if (status === 'success') {
        FailRecord.reset(link)
          .catch(err => this.log.error(err, `Unable to reset fail record ${link}`))
        if (memoryCollection) {
          this.memoryCollections[link] = memoryCollection
        }
      }

      ++this._cycleTotalCount
      ++completedLinks
      if (debugFeedURLs.has(link)) {
        this.log.info(`${link}: Link responded from processor`)
      }
      if (completedLinks === batchLength) {
        if (callback) {
          callback()
        }
      }
    }
  }

  processBatchGroup (batchGroup, batchIndex, debugFeedIDs, debugFeedURLs, onGroupCompleted) {
    const batchGroupIndex = this.batchGroups.indexOf(batchGroup)
    this.log.debug(`[GROUP] Batch group ${batchGroupIndex + 1}/${this.batchGroups.length}, starting batch index ${batchIndex + 1}/${batchGroup.length}`)
    const thisBatch = batchGroup[batchIndex]
    const batchLength = Object.keys(thisBatch).length
    const { process: processor } = new Processor()
    this._processorList.push(processor)
    const scopedBatchIndex = batchIndex
    const handler = this.createMessageHandler(batchLength, debugFeedURLs, () => {
      processor.removeAllListeners()
      processor.kill()
      this._processorList.splice(this._processorList.indexOf(processor), 1)
      this.log.debug(`[GROUP] Batch group ${batchGroupIndex + 1}/${this.batchGroups.length} completed batch index ${batchIndex + 1}/${batchGroup.length}`)
      if (scopedBatchIndex + 1 < batchGroup.length) {
        this.processBatchGroup(batchGroup, scopedBatchIndex + 1, debugFeedIDs, debugFeedURLs, onGroupCompleted)
      } else {
        onGroupCompleted()
      }
    })
    processor.on('message', handler.bind(this))
    processor.send({
      config: getConfig(),
      currentBatch: thisBatch,
      debugFeeds: Array.from(debugFeedIDs),
      debugURLs: Array.from(debugFeedURLs),
      headers: this.headers,
      memoryCollections: this.memoryCollections,
      runNum: this.ran,
      scheduleName: this.name
    })
  }

  terminate () {
    this.killChildren()
  }

  killChildren () {
    for (const x of this._processorList) {
      x.removeAllListeners()
      x.kill()
    }
    this._processorList = []
  }

  finishNoFeedsCycle () {
    const nameParen = this.name !== 'default' ? ` (${this.name})` : ''
    this.log.info(`Finished feed retrieval cycle${nameParen}. No feeds to retrieve`)
    this.emit('finish')
  }

  async finishFeedsCycle () {
    const cycleTime = (new Date() - this._startTime) / 1000
    await this.updateStats(cycleTime)
    const timeTaken = cycleTime.toFixed(2)
    const nameParen = this.name !== 'default' ? ` (${this.name})` : ''
    const count = this._cycleFailCount > 0 ? ` (${this._cycleFailCount}/${this._cycleTotalCount} failed)` : ` (${this._cycleTotalCount})`
    this.log.info(`Finished feed retrieval cycle${nameParen}${count}. Cycle Time: ${timeTaken}s`)
    this.emit('finish')
  }

  async updateStats (cycleTime) {
    try {
      const stats = await ScheduleStats.get(this.name)
      const data = {
        _id: this.name,
        feeds: this.feedCount,
        cycleTime,
        cycleFails: this._cycleFailCount,
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
      this.log.error(err, 'Unable to update statistics after cycle', err)
    }
  }
}

module.exports = ScheduleRun

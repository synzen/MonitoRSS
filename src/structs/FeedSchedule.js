const path = require('path')
const Schedule = require('./db/Schedule.js')
const FailRecord = require('./db/FailRecord.js')
const FeedData = require('./FeedData.js')
const Feed = require('./db/Feed.js')
const Supporter = require('./db/Supporter.js')
const EventEmitter = require('events').EventEmitter
const childProcess = require('child_process')
const maintenance = require('../maintenance/index.js')
const createLogger = require('../util/logger/create.js')
const ScheduleStats = require('../structs/db/ScheduleStats.js')
const getConfig = require('../config.js').get

/**
 * @typedef {string} FeedID
 */

/**
 * @typedef {string} FeedURL
 */

/**
 * @typedef {Object<string, any>} FeedObject
 */

class FeedSchedule extends EventEmitter {
  /**
   * @param {Object<string, any>} schedule
   */
  constructor (schedule) {
    if (!schedule.refreshRateMinutes) {
      throw new Error('No refreshRateMinutes has been declared for a schedule')
    }
    if (schedule.name !== 'default' && schedule.name !== Supporter.schedule.name && schedule.keywords.length === 0 && schedule.feeds.length === 0) {
      throw new Error(`Cannot create a FeedSchedule with invalid/empty keywords array for nondefault schedule (name: ${schedule.name})`)
    }
    super()
    this.name = schedule.name
    this.log = createLogger('M')
    this.refreshRate = schedule.refreshRateMinutes
    this._linksResponded = {}
    this._processorList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    // ONLY FOR DATABASELESS USE. Object of collection ids as keys, and arrays of objects (AKA articles) as values
    this.memoryCollections = Schedule.isMongoDatabase ? undefined : {}
    this.feedCount = 0 // For statistics
    this.ran = 0 // # of times this schedule has ran
    this.headers = {}
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
   */
  async getFeedDatas (feeds) {
    const schedules = await Schedule.getAll()
    const supporterGuilds = await Supporter.getValidGuilds()
    const determinedSchedules = await Promise.all(
      feeds.map(feed => feed.determineSchedule(schedules, supporterGuilds))
    )
    const feedsToFetchData = []
    for (var i = feeds.length - 1; i >= 0; --i) {
      const feed = feeds[i]
      const name = determinedSchedules[i].name
      // Match schedule
      if (this.name !== name) {
        continue
      }
      feedsToFetchData.push(FeedData.ofFeed(feed))
    }
    const feedDatas = await Promise.all(feedsToFetchData)
    const jsons = []
    for (var j = feedDatas.length - 1; j >= 0; --j) {
      jsons.push(feedDatas[j].toJSON())
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
   * @param {Object<string, any>} feedData
   * @param {Map<string, FailRecord>} failRecordsMap
   * @param {Set<string>} debugFeedIDs
   */
  isEligibleFeed (feedData, failRecordsMap, debugFeedIDs) {
    const toDebug = debugFeedIDs.has(feedData._id)
    /** @type {FailRecord} */
    if (feedData.disabled) {
      if (toDebug) {
        this.log.info(`${feedData._id}: Skipping feed delegation due to disabled status`)
      }
      return false
    }
    const failRecord = failRecordsMap.get(feedData.url)
    if (failRecord && (failRecord.hasFailed() && failRecord.alerted)) {
      if (toDebug) {
        this.log.info(`${feedData._id}: Skipping feed delegation, failed status: ${failRecord.hasFailed()}, alerted: ${failRecord.alerted}`)
      }
      return false
    }
    if (toDebug) {
      this.log.info(`${feedData._id}: Preparing for feed delegation`)
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
   * @param {Map<string, FailRecord>} failRecordsMap
   * @param {Set<string>} debugFeedIDs
   * @returns {URLMap}
   */
  mapFeedsByURL (feedDatas, failRecordsMap, debugFeedIDs) {
    const map = new Map()
    for (var i = feedDatas.length - 1; i >= 0; --i) {
      const feedData = feedDatas[i]

      if (!this.isEligibleFeed(feedData, failRecordsMap, debugFeedIDs)) {
        continue
      }

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
   * @param {Set<string>} debugFeedURLs
   * @returns {URLBatch[]}
   */
  createBatches (urlMap, debugFeedURLs) {
    const batches = []
    let batch = {}
    const config = getConfig()
    const batchSize = config.advanced.batchSize
    urlMap.forEach((feedByIDs, url) => {
      if (Object.keys(batch).length >= batchSize) {
        batches.push(batch)
        batch = {}
      }
      batch[url] = feedByIDs
      if (debugFeedURLs.has(url)) {
        this.log.info(`${url}: Attached URL to regular batch list for ${this.name}`)
      }
      this._linksResponded[url] = 1
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
    console.log(this._processorList.length)
    if (this.inProgress) {
      const failedURLs = []
      for (const link in this._linksResponded) {
        if (this._linksResponded[link] === 0) {
          continue
        }
        failedURLs.push(link)
        FailRecord.record(link, 'Failed to respond in a timely manner')
          .catch(err => this.log.error(err, `Unable to record url failure ${link}`))
      }
      this.log.warn({
        failedURLs: failedURLs.length > 25 ? 'Greater than 25 links, skipping log' : failedURLs.join('\n')
      }, `Processors from previous cycle were not killed (${this._processorList.length}). Killing all processors now. If repeatedly seeing this message, consider increasing your refresh time. The following links (${failedURLs.length}) failed to respond:`)
      this.killChildren()
    }
    this._startTime = new Date()
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._linksResponded = {}
    const config = getConfig()

    const feeds = await Feed.getAll()
    const debugFeedURLs = this.getDebugURLs(feeds, debugFeedIDs)
    const failRecordMap = await this.getFailRecordMap()
    // Check the limits
    await maintenance.checkLimits.limits(feeds)
    // Get feed data
    const feedDatas = await this.getFeedDatas(feeds)
    this.feedCount = feedDatas.length
    // Put all feeds with the same URLs together
    const urlMap = this.mapFeedsByURL(feedDatas, failRecordMap, debugFeedIDs)
    if (urlMap.size === 0) {
      this.inProgress = false
      return this._finishCycle(true)
    }
    this.inProgress = true
    // Batch them up
    const batches = this.createBatches(urlMap, debugFeedURLs)
    const batchGroups = this.createBatchGroups(batches, config.advanced.parallelBatches)
    let groupsCompleted = 0
    for (const group of batchGroups) {
      this.processBatchGroup(group, 0, debugFeedIDs, debugFeedURLs, () => {
        if (++groupsCompleted === batchGroups.length) {
          this._finishCycle()
        }
      })
    }
  }

  createMessageHandler (batchLength, debugFeedURLs, callback) {
    let completedLinks = 0
    return linkCompletion => {
      if (linkCompletion.status === 'headers') {
        this.headers[linkCompletion.link] = {
          lastModified: linkCompletion.lastModified,
          etag: linkCompletion.etag
        }
        return
      }
      if (linkCompletion.status === 'pendingArticle') {
        return this.emit('pendingArticle', linkCompletion.pendingArticle)
      }
      if (linkCompletion.status === 'failed') {
        ++this._cycleFailCount
        FailRecord.record(linkCompletion.link)
          .catch(err => this.log.error(err, `Unable to record url failure ${linkCompletion.link}`))
      } else if (linkCompletion.status === 'success') {
        FailRecord.reset(linkCompletion.link)
          .catch(err => this.log.error(err, `Unable to reset fail record ${linkCompletion.link}`))
        if (linkCompletion.memoryCollection) {
          this.memoryCollections[linkCompletion.link] = linkCompletion.memoryCollection
        }
      }

      ++this._cycleTotalCount
      ++completedLinks
      --this._linksResponded[linkCompletion.link]
      if (debugFeedURLs.has(linkCompletion.link)) {
        this.log.info(`${linkCompletion.link}: Link responded from processor`)
      }
      if (completedLinks === batchLength) {
        if (callback) {
          callback()
        }
      }
    }
  }

  processBatchGroup (batchGroup, batchIndex, debugFeedIDs, debugFeedURLs, onGroupCompleted) {
    const thisBatch = batchGroup[batchIndex]
    const batchLength = Object.keys(thisBatch).length
    const processor = childProcess.fork(path.join(__dirname, '..', 'util', 'processor.js'))
    this._processorList.push(processor)
    const scopedBatchIndex = batchIndex
    const handler = this.createMessageHandler(batchLength, debugFeedURLs, () => {
      processor.kill()
      this._processorList.splice(this._processorList.indexOf(processor), 1)
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

  killChildren () {
    for (const x of this._processorList) {
      x.kill()
    }
    this._processorList = []
  }

  _finishCycle (noFeeds) {
    const cycleTime = (new Date() - this._startTime) / 1000
    this.updateStats(cycleTime)
    const timeTaken = cycleTime.toFixed(2)
    const nameParen = this.name !== 'default' ? ` (${this.name})` : ''
    if (noFeeds) {
      this.log.info(`Finished feed retrieval cycle${nameParen}. No feeds to retrieve`)
    } else {
      if (this._processorList.length === 0) this.inProgress = false
      this.emit('finish')
      const count = this._cycleFailCount > 0 ? ` (${this._cycleFailCount}/${this._cycleTotalCount} failed)` : ` (${this._cycleTotalCount})`
      this.log.info(`Finished feed retrieval cycle${nameParen}${count}. Cycle Time: ${timeTaken}s`)
    }
    ++this.ran
  }

  updateStats (cycleTime) {
    ScheduleStats.get(this.name)
      .then(stats => {
        const data = {
          _id: this.name,
          feeds: this.feedCount,
          cycleTime,
          cycleFails: this._cycleFailCount,
          cycleURLs: this._cycleTotalCount,
          lastUpdated: new Date().toISOString()
        }
        if (!stats) {
          stats = new ScheduleStats(data)
          return stats.save()
        } else {
          stats.feeds = data.feeds
          stats.cycleTime = Math.round((data.cycleTime + stats.cycleTime) / 2)
          stats.cycleFails = Math.round((data.cycleFails + stats.cycleFails) / 2)
          stats.cycleURLs = data.cycleURLs
          stats.lastUpdated = data.lastUpdated
          return stats.save()
        }
      }).catch(err => this.log.error(err, 'Unable to update statistics after cycle', err))
  }
}

module.exports = FeedSchedule

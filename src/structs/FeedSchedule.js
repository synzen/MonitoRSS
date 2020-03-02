const path = require('path')
const config = require('../config.js')
const Schedule = require('./db/Schedule.js')
const FailRecord = require('./db/FailRecord.js')
const FeedData = require('./FeedData.js')
const Supporter = require('./db/Supporter.js')
const EventEmitter = require('events')
const childProcess = require('child_process')
const maintenance = require('../maintenance/index.js')
const createLogger = require('../util/logger/create.js')
const ScheduleStats = require('../structs/db/ScheduleStats.js')

const BATCH_SIZE = config.advanced.batchSize

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
    this.log = createLogger(`M`)
    this.refreshRate = schedule.refreshRateMinutes
    this._linksResponded = {}
    this._processorList = []
    this._regBatchList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._sourceList = new Map()
    this.failRecords = new Map()
    // ONLY FOR DATABASELESS USE. Object of collection ids as keys, and arrays of objects (AKA articles) as values
    this.memoryCollections = Schedule.isMongoDatabase ? undefined : {}
    this.feedCount = 0 // For statistics
    this.ran = 0 // # of times this schedule has ran
    this.headers = {}

    // For vip tracking
    this.allowWebhooks = new Map()
  }

  /**
   * @param {FeedData} feed
   * @param {Set<string>} debugFeedIDs
   */
  _delegateFeed (feedData, debugFeedIDs) {
    const debug = debugFeedIDs.has(feedData._id)
    if (Supporter.enabled && !this.allowWebhooks.has(feedData.guild) && feedData.webhook) {
      // log.cycle.warning(`Illegal webhook found for guild ${guildRss.id} for source ${rssName}`)
      feedData.webhook = undefined
    }

    if (this._sourceList.has(feedData.url)) { // Each item in the this._sourceList has a unique URL, with every source with this the same link aggregated below it
      let linkList = this._sourceList.get(feedData.url)
      linkList[feedData._id] = feedData
      if (debug) {
        this.log.info(`${feedData._id}: Adding to pre-existing source list`)
      }
    } else {
      let linkList = {}
      linkList[feedData._id] = feedData
      this._sourceList.set(feedData.url, linkList)
      if (debug) {
        this.log.info(`${feedData._id}: Creating new source list`)
      }
    }
  }

  /**
   * @param {Object<string, any>} feedData
   * @param {Set<string>} debugFeedIDs
   */
  _addToSourceLists (feedData, debugFeedIDs) { // rssList is an object per guildRss
    const toDebug = debugFeedIDs.has(feedData._id)
    /** @type {FailRecord} */
    const failRecord = this.failRecords.get(feedData.url)

    if (feedData.disabled) {
      if (toDebug) {
        this.log.info(`${feedData._id}: Skipping feed delegation due to disabled status`)
      }
      return false
    }

    if (failRecord && (failRecord.hasFailed() && failRecord.alerted)) {
      if (toDebug) {
        this.log.info(`${feedData._id}: Skipping feed delegation, failed status: ${failRecord.hasFailed()}, alerted: ${failRecord.alerted}`)
      }
      return false
    }

    if (toDebug) {
      this.log.info(`${feedData._id}: Preparing for feed delegation`)
      this.debugFeedLinks.add(feedData.url)
    }

    this._delegateFeed(feedData, debugFeedIDs)
    return true
  }

  /**
   * @param {Set<string>} debugFeedURLs
   */
  _genBatchLists (debugFeedURLs) {
    let batch = {}

    this._sourceList.forEach((rssList, url) => { // rssList per url
      if (Object.keys(batch).length >= BATCH_SIZE) {
        this._regBatchList.push(batch)
        batch = {}
      }
      batch[url] = rssList
      if (debugFeedURLs.has(url)) {
        this.log.info(`${url}: Attached URL to regular batch list for ${this.name}`)
      }
      this._linksResponded[url] = 1
    })

    if (Object.keys(batch).length > 0) {
      this._regBatchList.push(batch)
    }
  }

  /**
   * @param {Set<string>} debugFeedIDs
   */
  async run (debugFeedIDs) {
    if (this.inProgress) {
      let list = ''
      let c = 0
      for (const link in this._linksResponded) {
        if (this._linksResponded[link] === 0) {
          continue
        }
        FailRecord.record(link, 'Failed to respond in a timely manner')
          .catch(err => this.log.error(err, `Unable to record url failure ${link}`))
        list += `${link}\n`
        ++c
      }
      if (c > 25) {
        list = 'Greater than 25 links, skipping log'
      }
      this.log.warn({
        failedURLs: list
      }, `Processors from previous cycle were not killed (${this._processorList.length}). Killing all processors now. If repeatedly seeing this message, consider increasing your refresh time. The following links (${c}) failed to respond:`)
      this.killChildren()
    }

    this.debugFeedLinks.clear()
    this.allowWebhooks.clear()
    const supporterLimits = new Map()

    if (Supporter.enabled) {
      const supporters = await Supporter.getValidSupporters()
      for (const supporter of supporters) {
        const [ allowWebhook, maxFeeds ] = await Promise.all([
          supporter.getWebhookAccess(),
          supporter.getMaxFeeds()
        ])
        const guilds = supporter.guilds
        for (const guildId of guilds) {
          if (allowWebhook) {
            this.allowWebhooks.set(guildId, true)
          }
          supporterLimits.set(guildId, maxFeeds)
        }
      }
    }

    const [
      failRecords,
      feedDatas,
      supporterGuilds,
      schedules
    ] = await Promise.all([
      FailRecord.getAll(),
      FeedData.getAll(),
      Supporter.getValidGuilds(),
      Schedule.getAll()
    ])
    const feeds = feedDatas.map(data => data.feed)
    const feedDataJSONs = feedDatas.map(data => data.toJSON())

    // Save the fail records
    this.failRecords.clear()
    for (const record of failRecords) {
      this.failRecords.set(record.url, record)
    }

    // Check the limits
    await maintenance.checkLimits(feeds, supporterLimits)

    this._startTime = new Date()
    this._regBatchList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._linksResponded = {}

    this._sourceList.clear()
    let feedCount = 0 // For statistics in storage
    const debugFeedURLs = new Set()
    const determinedSchedules = await Promise.all(
      feeds.map(feed => feed.determineSchedule(schedules, supporterGuilds))
    )
    for (let i = 0; i < feeds.length; ++i) {
      const feedData = feedDataJSONs[i]
      const name = determinedSchedules[i].name
      if (this.name !== name) {
        continue
      }

      // Initialize memory collections
      if (this.memoryCollections && !this.memoryCollections[feedData.url]) {
        this.memoryCollections[feedData.url] = []
      }

      if (debugFeedIDs.has(feedData._id)) {
        debugFeedURLs.add(feedData.url)
        this.log.info(`${feedData._id}: Assigned schedule`)
      }

      // Add to source lists
      if (this._addToSourceLists(feedData, debugFeedIDs)) {
        feedCount++
      }
    }

    this.inProgress = true
    this.feedCount = feedCount
    this._genBatchLists(debugFeedURLs)

    if (this._sourceList.size === 0) {
      this.inProgress = false
      return this._finishCycle(true)
    }

    this._getBatchParallel(debugFeedIDs, debugFeedURLs)
  }

  /**
   * @param {Set<string>} debugFeedIDs
   * @param {Set<string>} debugFeedURLs
   */
  _getBatchParallel (debugFeedIDs, debugFeedURLs) {
    const totalBatchLengths = this._regBatchList.length
    let completedBatches = 0

    let willCompleteBatch = 0
    let regIndices = this._regBatchList.map((batch, index) => index)

    const deployProcessor = (currentBatch, callback) => {
      if (!currentBatch) {
        return
      }
      let completedLinks = 0
      const currentBatchLen = Object.keys(currentBatch).length
      this._processorList.push(childProcess.fork(path.join(__dirname, '..', 'util', 'processor.js')))

      const processorIndex = this._processorList.length - 1
      const processor = this._processorList[processorIndex]

      processor.on('message', linkCompletion => {
        if (linkCompletion.status === 'headers') {
          this.headers[linkCompletion.link] = {
            lastModified: linkCompletion.lastModified,
            etag: linkCompletion.etag
          }
          return
        }
        if (linkCompletion.status === 'article') {
          return this.emit('article', linkCompletion.article)
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
        if (completedLinks === currentBatchLen) {
          if (callback) {
            callback()
          }
          completedBatches++
          if (completedBatches === totalBatchLengths) {
            this._processorList.length = 0
            this._finishCycle()
          }
        }
      })

      processor.send({
        config,
        currentBatch,
        debugFeeds: Array.from(debugFeedIDs),
        debugURLs: Array.from(debugFeedURLs),
        headers: this.headers,
        memoryCollections: this.memoryCollections,
        runNum: this.ran,
        scheduleName: this.name
      })
    }

    const spawn = (count) => {
      for (let q = 0; q < count; ++q) {
        willCompleteBatch++
        deployProcessor(this._regBatchList[regIndices.shift()], () => {
          if (willCompleteBatch < totalBatchLengths) {
            spawn(1)
          }
        })
      }
    }

    spawn(config.advanced.parallelBatches)
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
      }).catch(err => this.log.error(err, `Unable to update statistics after cycle`, err))
  }
}

module.exports = FeedSchedule

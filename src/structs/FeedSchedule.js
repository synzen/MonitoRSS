const path = require('path')
const config = require('../config.js')
const Schedule = require('./db/Schedule.js')
const FailRecord = require('./db/FailRecord.js')
const ShardStats = require('./db/ShardStats.js')
const FeedData = require('./FeedData.js')
const Supporter = require('./db/Supporter.js')
const debug = require('../util/debugFeeds.js')
const EventEmitter = require('events')
const childProcess = require('child_process')
const maintenance = require('../util/maintenance/index.js')
const log = require('../util/logger.js')
const ipc = require('../util/ipc.js')

const BATCH_SIZE = config.advanced.batchSize

class FeedSchedule extends EventEmitter {
  /**
   * @param {import('discord.js').Client} bot
   * @param {Object<string, any>} schedule
   * @param {import('./ScheduleManager.js')} scheduleManager
   */
  constructor (bot, schedule, scheduleManager) {
    if (!schedule.refreshRateMinutes) {
      throw new Error('No refreshRateMinutes has been declared for a schedule')
    }
    if (schedule.name !== 'default' && schedule.name !== Supporter.schedule.name && schedule.keywords.length === 0 && schedule.feeds.length === 0) {
      throw new Error(`Cannot create a FeedSchedule with invalid/empty keywords array for nondefault schedule (name: ${schedule.name})`)
    }
    super()
    this.bot = bot
    this.name = schedule.name
    this.shardID = scheduleManager.shardID
    this.refreshRate = schedule.refreshRateMinutes
    this._linksResponded = {}
    this._processorList = []
    this._regBatchList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._sourceList = new Map()
    this.failRecords = new Map()
    // ONLY FOR DATABASELESS USE. Object of collection ids as keys, and arrays of objects (AKA articles) as values
    this.feedData = Schedule.isMongoDatabase ? undefined : {}
    this.feedCount = 0 // For statistics
    this.ran = 0 // # of times this schedule has ran
    this.headers = {}
    this.debugFeedLinks = new Set()

    // For vip tracking
    this.allowWebhooks = new Map()
  }

  /**
   * @param {FeedData} feed
   */
  _delegateFeed (feedData) {
    if (Supporter.enabled && !this.allowWebhooks.has(feedData.guild) && feedData.webhook) {
      // log.cycle.warning(`Illegal webhook found for guild ${guildRss.id} for source ${rssName}`)
      feedData.webhook = undefined
    }

    if (this._sourceList.has(feedData.url)) { // Each item in the this._sourceList has a unique URL, with every source with this the same link aggregated below it
      let linkList = this._sourceList.get(feedData.url)
      linkList[feedData._id] = feedData
      if (debug.feeds.has(feedData._id)) {
        log.debug.info(`${feedData._id}: Adding to pre-existing source list`)
      }
    } else {
      let linkList = {}
      linkList[feedData._id] = feedData
      this._sourceList.set(feedData.url, linkList)
      if (debug.feeds.has(feedData._id)) {
        log.debug.info(`${feedData._id}: Creating new source list`)
      }
    }
  }

  /**
   * @param {Object<string, any>} feedData
   */
  _addToSourceLists (feedData) { // rssList is an object per guildRss
    const toDebug = debug.feeds.has(feedData._id)
    /** @type {FailRecord} */
    const failRecord = this.failRecords.get(feedData.url)

    if (feedData.disabled) {
      if (toDebug) {
        log.debug.info(`Shard ${this.shardID} ${feedData._id}: Skipping feed delegation due to disabled status`)
      }
      return false
    }

    if (failRecord && (failRecord.hasFailed() && failRecord.alerted)) {
      if (toDebug) {
        log.debug.info(`Shard ${this.shardID} ${feedData._id}: Skipping feed delegation, failed status: ${failRecord.hasFailed()}, alerted: ${failRecord.alerted}`)
      }
      return false
    }

    if (toDebug) {
      log.debug.info(`Shard ${this.shardID} ${feedData._id}: Preparing for feed delegation`)
      this.debugFeedLinks.add(feedData.url)
    }

    this._delegateFeed(feedData)
    return true
  }

  _genBatchLists () {
    let batch = {}

    this._sourceList.forEach((rssList, link) => { // rssList per link
      if (Object.keys(batch).length >= BATCH_SIZE) {
        this._regBatchList.push(batch)
        batch = {}
      }
      batch[link] = rssList
      if (debug.links.has(link)) {
        log.debug.info(`Shard ${this.shardID} ${link}: Attached URL to regular batch list for ${this.name}`)
      }
      this._linksResponded[link] = 1
    })

    if (Object.keys(batch).length > 0) this._regBatchList.push(batch)
  }

  async run () {
    if (this.inProgress) {
      let list = ''
      let c = 0
      for (const link in this._linksResponded) {
        if (this._linksResponded[link] === 0) {
          continue
        }
        FailRecord.record(link, 'Failed to respond in a timely manner')
          .catch(err => log.cycle.warning(`Shard ${this.shardID} Unable to record url failure ${link}`, err))
        list += `${link}\n`
        ++c
      }
      if (c > 25) {
        list = 'Greater than 25 links, skipping log'
      }
      log.cycle.warning(`Shard ${this.shardID} Schedule ${this.name} - Processors from previous cycle were not killed (${this._processorList.length}). Killing all processors now. If repeatedly seeing this message, consider increasing your refresh time. The following links (${c}) failed to respond:`)
      console.log(list)
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

    const feedDataQuery = {
      guild: {
        $in: this.bot.guilds.cache.keyArray()
      }
    }
    const [
      failRecords,
      feedDatas,
      supporterGuilds,
      schedules
    ] = await Promise.all([
      FailRecord.getAll(),
      FeedData.getManyByQuery(feedDataQuery),
      Supporter.getValidGuilds(),
      Schedule.getAll()
    ])
    const feeds = feedDatas.map(data => data.feed)
    const feedDataJSONs = feedDatas.map(data => data.toJSON())
    const filteredFeeds = []
    const filteredFeedsIds = new Set()
    // Filter in feeds only this bot contains
    for (const feed of feeds) {
      const hasChannel = this.bot.channels.cache.has(feed.channel)
      if (!hasChannel) {
        if (debug.feeds.has(feed._id)) {
          log.debug.info(`Shard ${this.shardID} ${feed._id}: Not processing feed - missing channel: ${!hasChannel}. Assigned to schedule ${this.name}`)
        }
      } else {
        filteredFeeds.push(feed)
        filteredFeedsIds.add(feed._id)
      }
    }

    // Save the fail records
    this.failRecords.clear()
    for (const record of failRecords) {
      this.failRecords.set(record.url, record)
    }

    // Check the permissions
    await Promise.all(filteredFeeds.map(feed => {
      return maintenance.checkPermissions(feed, this.bot)
    }))

    // Check the limits
    await maintenance.checkLimits(filteredFeeds, supporterLimits)

    this._startTime = new Date()
    this._regBatchList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._linksResponded = {}

    this._sourceList.clear()
    let feedCount = 0 // For statistics in storage
    const determineSchedulePromises = []
    filteredFeeds.forEach(feed => {
      determineSchedulePromises.push(feed.determineSchedule(schedules, supporterGuilds))
    })
    const determinedSchedules = await Promise.all(determineSchedulePromises)
    for (let i = 0; i < filteredFeeds.length; ++i) {
      const feedData = feedDataJSONs[i]
      const name = determinedSchedules[i].name
      if (this.name !== name) {
        continue
      }
      if (debug.feeds.has(feedData._id)) {
        log.debug.info(`Shard ${this.shardID} ${feedData._id}: Assigned schedule ${this.name}`)
      }
      if (this._addToSourceLists(feedData)) {
        feedCount++
      }
    }

    this.inProgress = true
    this.feedCount = feedCount
    this._genBatchLists()

    if (this._sourceList.size === 0) {
      this.inProgress = false
      return this._finishCycle(true)
    }

    this._getBatchParallel()
  }

  _getBatchParallel () {
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
            .catch(err => log.cycle.warning(`Shard ${this.shardID} Unable to record url failure ${linkCompletion.link}`, err))
        } else if (linkCompletion.status === 'success') {
          FailRecord.reset(linkCompletion.link)
            .catch(err => log.cycle.warning(`Shard ${this.shardID} Unable to reset fail record ${linkCompletion.link}`, err))
          if (linkCompletion.memoryCollection) {
            this.feedData[linkCompletion.link] = linkCompletion.memoryCollection
          }
        }

        ++this._cycleTotalCount
        ++completedLinks
        --this._linksResponded[linkCompletion.link]
        if (debug.links.has(linkCompletion.link)) {
          log.debug.info(`Shard ${this.shardID} ${linkCompletion.link}: Link responded from processor for ${this.name}`)
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
        debugFeeds: debug.feeds.serialize(),
        debugLinks: [
          ...debug.links.serialize(),
          ...this.debugFeedLinks
        ],
        headers: this.headers,
        feedData: this.feedData,
        runNum: this.ran,
        scheduleName: this.name,
        shardID: this.shardID
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
    ipc.send(ipc.TYPES.SCHEDULE_COMPLETE, {
      refreshRate: this.refreshRate
    })
    const cycleTime = (new Date() - this._startTime) / 1000
    const timeTaken = cycleTime.toFixed(2)
    ShardStats.get(this.shardID.toString())
      .then(stats => {
        const data = {
          _id: this.shardID.toString(),
          feeds: this.feedCount,
          cycleTime,
          cycleFails: this._cycleFailCount,
          cycleURLs: this._cycleTotalCount,
          lastUpdated: new Date().toISOString()
        }
        if (!stats) {
          stats = new ShardStats(data)
          return stats.save()
        } else {
          stats.feeds = data.feeds
          stats.cycleTime = ((data.cycleTime + stats.cycleTime) / 2).toFixed(2)
          stats.cycleFails = ((data.cycleFails + stats.cycleFails) / 2).toFixed(2)
          stats.cycleURLs = data.cycleURLs
          stats.lastUpdated = data.lastUpdated
          return stats.save()
        }
      }).catch(err => log.general.warning(`Shard ${this.shardID} Unable to update statistics after cycle`, err, true))

    const name = this.name === 'default' ? 'default ' : ''
    const nameParen = this.name !== 'default' ? ` (${this.name})` : ''
    if (noFeeds) {
      log.cycle.info(`Shard ${this.shardID} Finished ${name}feed retrieval cycle${nameParen}. No feeds to retrieve`)
    } else {
      if (this._processorList.length === 0) this.inProgress = false
      this.emit('finish')
      const count = this._cycleFailCount > 0 ? ` (${this._cycleFailCount}/${this._cycleTotalCount} failed)` : ` (${this._cycleTotalCount})`
      log.cycle.info(`Shard ${this.shardID} Finished ${name}feed retrieval cycle${nameParen}${count}. Cycle Time: ${timeTaken}s`)
    }

    ++this.ran
  }
}

module.exports = FeedSchedule

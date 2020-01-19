const path = require('path')
const config = require('../config.js')
const Schedule = require('./db/Schedule.js')
const Profile = require('./db/Profile.js')
const FailCounter = require('./db/FailCounter.js')
const Subscriber = require('./db/Subscriber.js')
const Format = require('./db/Format.js')
const FilteredFormat = require('./db/FilteredFormat.js')
const ShardStats = require('./db/ShardStats.js')
const Feed = require('./db/Feed.js')
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
    this._profilesById = new Map()
    this._formatsByFeedId = new Map()
    this._filteredFormatsByFeedId = new Map()
    this._subscribersByFeedId = new Map()
    this.failCounters = new Map()
    // ONLY FOR DATABASELESS USE. Object of collection ids as keys, and arrays of objects (AKA articles) as values
    this.feedData = Feed.isMongoDatabase ? undefined : {}
    this.feedCount = 0 // For statistics
    this.ran = 0 // # of times this schedule has ran
    this.headers = {}
    this.debugFeedLinks = new Set()

    // For vip tracking
    this.allowWebhooks = new Map()
  }

  /**
   * @param {Feed} feed
   */
  _delegateFeed (feed) {
    // The guild id and date settings are needed after it is sent to the child process, and sent back for any ArticleMessages to access
    const guild = this._profilesById.get(feed.guild)
    const format = this._formatsByFeedId.get(feed._id)
    const subscribers = this._subscribersByFeedId.get(feed._id) || []
    const filteredFormats = this._filteredFormatsByFeedId.get(feed._id) || []
    const data = {
      ...feed.toJSON(),
      subscribers,
      format,
      filteredFormats,
      dateSettings: !guild
        ? {}
        : {
          timezone: guild.timezone,
          format: guild.dateFormat,
          language: guild.dateLanguage
        }
    }

    if (Supporter.enabled && !this.allowWebhooks.has(feed.guild) && feed.webhook) {
      // log.cycle.warning(`Illegal webhook found for guild ${guildRss.id} for source ${rssName}`)
      feed.webhook = undefined
    }

    if (this._sourceList.has(feed.url)) { // Each item in the this._sourceList has a unique URL, with every source with this the same link aggregated below it
      let linkList = this._sourceList.get(feed.url)
      linkList[feed._id] = data
      if (debug.feeds.has(feed._id)) {
        log.debug.info(`${feed._id}: Adding to pre-existing source list`)
      }
    } else {
      let linkList = {}
      linkList[feed._id] = data
      this._sourceList.set(feed.url, linkList)
      if (debug.feeds.has(feed._id)) {
        log.debug.info(`${feed._id}: Creating new source list`)
      }
    }
  }

  /**
   * @param {Feed} feed
   */
  _addToSourceLists (feed) { // rssList is an object per guildRss
    const toDebug = debug.feeds.has(feed._id)
    const failCounter = this.failCounters.get(feed.url)

    if (feed.disabled) {
      if (toDebug) {
        log.debug.info(`Shard ${this.shardID} ${feed._id}: Skipping feed delegation due to disabled status`)
      }
      return false
    }

    if (failCounter && failCounter.hasFailed()) {
      if (toDebug) {
        log.debug.info(`Shard ${this.shardID} ${feed._id}: Skipping feed delegation due to failed status: ${failCounter.hasFailed()}`)
      }
      return false
    }

    if (toDebug) {
      log.debug.info(`Shard ${this.shardID} ${feed._id}: Preparing for feed delegation`)
      this.debugFeedLinks.add(feed.url)
    }

    this._delegateFeed(feed)
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
        FailCounter.increment(link, 'Failed to respond in a timely manner')
          .catch(err => log.cycle.warning(`Shard ${this.shardID} Unable to increment fail counter for ${link}`, err))
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

    this._formatsByFeedId.clear()
    this._filteredFormatsByFeedId.clear()
    this._subscribersByFeedId.clear()
    const [
      failCounters,
      profiles,
      feeds,
      formats,
      filteredFormats,
      subscribers,
      supporterGuilds,
      schedules
    ] = await Promise.all([
      FailCounter.getAll(),
      Profile.getAll(),
      Feed.getAll(),
      Format.getAll(),
      FilteredFormat.getAll(),
      Subscriber.getAll(),
      Supporter.getValidGuilds(),
      Schedule.getAll()
    ])
    const filteredFeeds = []
    const filteredFeedsIds = new Set()

    // Get the profiles
    profiles.forEach(profile => {
      const hasGuild = this.bot.guilds.has(profile._id)
      if (hasGuild) {
        this._profilesById.set(profile.id, profile)
      }
    })

    // Filter in feeds only this bot contains
    for (const feed of feeds) {
      const hasGuild = this.bot.guilds.has(feed.guild)
      const hasChannel = this.bot.channels.has(feed.channel)
      if (!hasGuild || !hasChannel) {
        if (debug.feeds.has(feed._id)) {
          log.debug.info(`Shard ${this.shardID} ${feed._id}: Not processing feed - missing guild: ${!hasGuild}, missing channel: ${!hasChannel}. Assigned to schedule ${this.name}`)
        }
      } else {
        filteredFeeds.push(feed)
        filteredFeedsIds.add(feed._id)
      }
    }

    // Get the formats
    formats.forEach(format => {
      if (!filteredFeedsIds.has(format.feed)) {
        return
      }
      this._formatsByFeedId.set(format.feed, format.toJSON())
    })

    // Get the filtered formats
    filteredFormats.forEach(format => {
      if (!filteredFeedsIds.has(format.feed)) {
        return
      }
      if (!this._filteredFormatsByFeedId.has(format.feed)) {
        this._filteredFormatsByFeedId.set(format.feed, [format.toJSON()])
      } else {
        this._filteredFormatsByFeedId.get(format.feed).push(format.toJSON())
      }
    })

    // Get the subscribers
    subscribers.forEach(subscriber => {
      if (!filteredFeedsIds.has(subscriber.feed)) {
        return
      }
      const feedId = subscriber.feed
      const json = subscriber.toJSON()
      if (!this._subscribersByFeedId.has(feedId)) {
        this._subscribersByFeedId.set(feedId, [json])
      } else {
        this._subscribersByFeedId.get(feedId).push(json)
      }
    })

    // Save the fail counters
    this.failCounters.clear()
    for (const counter of failCounters) {
      this.failCounters.set(counter.url, counter)
    }

    // Check the permissions
    await Promise.all(filteredFeeds.map(feed => {
      const format = this._formatsByFeedId[feed._id]
      return maintenance.checkPermissions(feed, format, this.bot)
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
      const feed = filteredFeeds[i]
      const name = determinedSchedules[i].name
      if (this.name !== name) {
        return
      }
      if (debug.feeds.has(feed._id)) {
        log.debug.info(`Shard ${this.shardID} ${feed._id}: Assigned schedule ${this.name}`)
      }
      if (this._addToSourceLists(feed)) {
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
      this._processorList.push(childProcess.fork(path.join(__dirname, '..', 'rss', 'isolatedMethod.js')))

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
        if (linkCompletion.status === 'batch_connected' && callback) {
          // Spawn processor for next batch
          return callback()
        }
        if (linkCompletion.status === 'failed') {
          ++this._cycleFailCount
          FailCounter.increment(linkCompletion.link)
            .catch(err => log.cycle.warning(`Shard ${this.shardID} Unable to increment fail counter ${linkCompletion.link}`, err))
        } else if (linkCompletion.status === 'success') {
          FailCounter.reset(linkCompletion.link)
            .catch(err => log.cycle.warning(`Shard ${this.shardID} Unable to reset fail counter ${linkCompletion.link}`, err))
          // Only if config.database.uri is a databaseless folder path
          if (linkCompletion.feedCollectionId) {
            this.feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection
          }
        }

        ++this._cycleTotalCount
        ++completedLinks
        --this._linksResponded[linkCompletion.link]
        if (debug.links.has(linkCompletion.link)) {
          log.debug.info(`Shard ${this.shardID} ${linkCompletion.link}: Link responded from processor for ${this.name}`)
        }
        if (completedLinks === currentBatchLen) {
          completedBatches++
          processor.kill()
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

const getArticles = require('../rss/singleMethod.js')
const config = require('../config.js')
const checkGuild = require('../util/checkGuild.js')
const dbOps = require('../util/dbOps.js')
const debugFeeds = require('../util/debugFeeds.js').list
const EventEmitter = require('events')
const childProcess = require('child_process')
const storage = require('../util/storage.js') // All properties of storage must be accessed directly due to constant changes
const log = require('../util/logger.js')
const BATCH_SIZE = config.advanced.batchSize
const FAIL_LIMIT = config.feeds.failLimit

class FeedSchedule extends EventEmitter {
  constructor (bot, schedule, feedData, scheduleManager) {
    if (!schedule.refreshTimeMinutes) throw new Error('No refreshTimeMinutes has been declared for a schedule')
    if (schedule.name !== 'default' && schedule.name !== 'vip' && (!Array.isArray(schedule.keywords) || schedule.keywords.length === 0) && (!Array.isArray(schedule.rssNames) || schedule.rssNames.length === 0)) throw new Error(`Cannot create a FeedSchedule with invalid/empty keywords array for nondefault schedule (name: ${schedule.name})`)
    super()
    this.SHARD_ID = bot.shard && bot.shard.count > 0 ? 'SH ' + bot.shard.id + ' ' : ''
    this.shardId = bot.shard && bot.shard.count > 0 ? bot.shard.id : undefined
    this.bot = bot
    this.name = schedule.name
    this.scheduleManager = scheduleManager
    this.keywords = schedule.keywords
    this.rssNames = schedule.rssNames
    this.refreshTime = schedule.refreshTimeMinutes
    this._cookieServers = storage.cookieServers
    this._processorList = []
    this._regBatchList = []
    this._modBatchList = [] // Batch of sources with cookies
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._sourceList = new Map()
    this._modSourceList = new Map()
    this.feedData = feedData // Object of collection ids as keys, and arrays of objects as values
    this.feedCount = 0 // For statistics
    this.failedLinks = {}
    this.ran = 0 // # of times this schedule has ran

    // For vip tracking
    this.vipServers = []
    this.vipServerLimits = {}
    this.allowWebhooks = {}

    if (!this.bot.shard || this.bot.shard.count === 0) this._timer = setInterval(this.run.bind(this), this.refreshTime * 60000) // Only create an interval for itself if there is no sharding
    log.cycle.info(`${this.SHARD_ID}Schedule '${this.name}' has begun`)
  }

  _verifyCookieUse (id, advanced) {
    if (this._cookieServers.includes(id)) return true
    delete advanced.cookies
    return false
  }

  _delegateFeed (guildRss, rssName) {
    const source = { ...guildRss.sources[rssName] }

    // The guild id and date settings are needed after it is sent to the child process, and sent back for any ArticleMessages to access
    source.guildId = guildRss.id
    source.dateSettings = {
      timezone: guildRss.timezone,
      format: guildRss.dateFormat,
      language: guildRss.dateLanguage
    }

    if (!this.allowWebhooks[guildRss.id] && source.webhook) {
      // log.cycle.warning(`Illegal webhook found for guild ${guildRss.id} for source ${rssName}`)
      delete source.webhook
    }

    if (source.advanced && Object.keys(source.advanced).length > 0 && this._verifyCookieUse(guildRss.id, source.advanced)) { // Special source list for feeds with unique settings defined
      let linkList = {}
      linkList[rssName] = source
      this._modSourceList.set(source.link, linkList)
    } else if (this._sourceList.has(source.link)) { // Each item in the this._sourceList has a unique URL, with every source with this the same link aggregated below it
      let linkList = this._sourceList.get(source.link)
      linkList[rssName] = source
    } else {
      let linkList = {}
      linkList[rssName] = source
      this._sourceList.set(source.link, linkList)
    }
  }

  _addToSourceLists (guildRss, scheduleAssignmentOnly) { // rssList is an object per guildRss
    const rssList = guildRss.sources
    let c = 0 // To count and determine what feeds should be disabled if they violate their limits
    const max = this.vipServerLimits[guildRss.id] || config.feeds.max || 0
    const status = {}
    let feedCount = 0 // For statistics in storage

    for (var rssName in rssList) {
      const source = rssList[rssName]
      ++feedCount
      // Determine whether any feeds should be disabled
      if (((max !== 0 && ++c <= max) || max === 0) && source.disabled === true) {
        log.general.info(`Enabling feed named ${rssName} for server ${guildRss.id}...`)
        // dbOps.guildRss.enableFeed(guildRss, rssName, true).catch(err => log.general.warning(`Failed to enable feed named ${rssName}`, err))
        if (!status[source.channel]) status[source.channel] = { enabled: [], disabled: [] }
        status[source.channel].enabled.push(source.link)
      } else if (max !== 0 && c > max && source.disabled !== true) {
        log.general.warning(`Disabling feed named ${rssName} for server ${guildRss.id}...`)
        // dbOps.guildRss.disableFeed(guildRss, rssName, true).catch(err => log.general.warning(`Failed to disable feed named ${rssName}`, err))
        if (!status[source.channel]) status[source.channel] = { enabled: [], disabled: [] }
        status[source.channel].disabled.push(source.link)
      }

      if (!checkGuild.config(this.bot, guildRss, rssName) || typeof this.failedLinks[source.link] === 'string') continue

      // Take care of our VIPs
      if (config._vip === true && !source.link.includes('feed43')) {
        const validVip = this.vipServers.includes(guildRss.id)
        const vipSchedule = this.scheduleManager.getSchedule('vip')
        if (validVip) {
          if (storage.scheduleAssigned[rssName] !== 'vip') {
            if (storage.scheduleAssigned[rssName]) dbOps.linkTracker.decrement(source.link, storage.scheduleAssigned[rssName]).catch(err => log.cycle.warning(`${this.SHARD_ID}Unable to decrement link tracker for link ${source.link} before vip switch`, err))
            // log.cycle.info(`${this.SHARD_ID}Undelegated feed ${rssName} (${source.link}) has been delegated to custom schedule vip by rssName`)
            storage.scheduleAssigned[rssName] = 'vip'
            // Only do the below if ran is 0, since on initialization it counted it first already for link tracking purposes
            if (this.ran > 1) dbOps.linkTracker.increment(source.link, 'vip').catch(err => log.cycle.warning(`${this.SHARD_ID}Unable to increment vip link tracker for link ${source.link}`, err))
          }
          if (!vipSchedule) this.scheduleManager.addSchedule({ name: 'vip', refreshTimeMinutes: config._vipRefreshTimeMinutes ? config._vipRefreshTimeMinutes : 10, rssNames: [ rssName ] }) // Make it
          else if (!vipSchedule.rssNames.includes(rssName)) vipSchedule.rssNames.push(rssName)
        } else if (!validVip && storage.scheduleAssigned[rssName] === 'vip') {
          if (vipSchedule) vipSchedule.rssNames.splice(vipSchedule.rssNames.indexOf(rssName), 1)
          dbOps.linkTracker.decrement(source.link, 'vip').catch(err => log.cycle.warning(`${this.SHARD_ID}Unable to decrement link tracker for link ${source.link} after invalidated vip`, err))
          delete storage.scheduleAssigned[rssName]
          // This feed will be delegated to the default schedule, but no notification will be given since that is the default behavior
        }
      }

      // Then the peasantry
      if (storage.scheduleAssigned[rssName] === this.name && !scheduleAssignmentOnly) this._delegateFeed(guildRss, rssName) // If assigned to a this.schedule
      else if (this.name !== 'default' && !storage.scheduleAssigned[rssName]) { // If current feed this.schedule is a custom one and is not assigned
        const sRssNames = this.rssNames // Potential array
        if (sRssNames && sRssNames.includes(rssName)) {
          storage.scheduleAssigned[rssName] = this.name
          dbOps.linkTracker.increment(source.link, this.name).catch(err => log.cycle.warning(`${this.SHARD_ID}Unable to increment link tracker for link ${source.link} (a)`, err))
          if (!scheduleAssignmentOnly) this._delegateFeed(guildRss, rssName)
          log.cycle.info(`${this.SHARD_ID}Undelegated feed ${rssName} (${source.link}) has been delegated to custom schedule ${this.name} by rssName`)
          continue
        }
        if (!this.keywords) continue
        this.keywords.forEach(word => {
          if (!source.link.includes(word)) return
          storage.scheduleAssigned[rssName] = this.name // Assign this feed to this this.schedule so no other feed this.schedule can take it on subsequent cycles
          dbOps.linkTracker.increment(source.link, this.name).catch(err => log.cycle.warning(`${this.SHARD_ID}Unable to increment link tracker for link ${source.link} (b)`, err))
          if (!scheduleAssignmentOnly) this._delegateFeed(guildRss, rssName)
          log.cycle.info(`${this.SHARD_ID}Undelegated feed ${rssName} (${source.link}) has been delegated to custom schedule ${this.name} by keywords`)
        })
      } else if (!storage.scheduleAssigned[rssName]) { // Has no this.schedule, was not previously assigned, so see if it can be assigned to default
        let reserved = false
        if (storage.allScheduleRssNames.includes(rssName)) reserved = true
        storage.allScheduleWords.forEach(item => { // If it can't be assigned to default, it will eventually be assigned to other schedules when they occur
          if (source.link.includes(item)) reserved = true
        })
        if (!reserved) {
          storage.scheduleAssigned[rssName] = 'default'
          dbOps.linkTracker.increment(source.link, 'default').catch(err => log.cycle.warning(`${this.SHARD_ID}Unable to increment link tracker for link ${source.link} (c)`, err))
          if (!scheduleAssignmentOnly) this._delegateFeed(guildRss, rssName)
        }
      }
    }

    // Send notices about any feeds that were enabled/disabled
    if (config._skipMessages === true) return feedCount
    // for (var channelId in status) {
    //   let m = '**ATTENTION** - The following changes have been made due to a feed limit change for this server:\n\n'
    //   const enabled = status[channelId].enabled
    //   const disabled = status[channelId].disabled
    //   if (enabled.length === 0 && disabled.length === 0) continue
    //   for (var a = 0; a < enabled.length; ++a) m += `Feed <${enabled[a]}> has been enabled.\n`
    //   for (var b = 0; b < disabled.length; ++b) m += `Feed <${disabled[b]}> has been disabled.\n`
    //   const channel = this.bot.channels.get(channelId)
    //   if (channel) {
    //     channel.send(m)
    //       .then(m => log.general.info(`Sent feed enable/disable notice to server`, channel.guild, channel))
    //       .catch(err => log.general.warning('Unable to send feed enable/disable notice', channel.guild, channel, err))
    //   }
    // }
    return feedCount
  }

  _genBatchLists () { // Each batch is a bunch of links. Too many links at once will cause request failures.
    let batch = {}

    this._sourceList.forEach((rssList, link) => { // rssList per link
      if (Object.keys(batch).length >= BATCH_SIZE) {
        this._regBatchList.push(batch)
        batch = {}
      }
      batch[link] = rssList
    })

    if (Object.keys(batch).length > 0) this._regBatchList.push(batch)

    batch = {}

    this._modSourceList.forEach((source, link) => { // One RSS source per link instead of an rssList
      if (Object.keys(batch).length >= BATCH_SIZE) {
        this._modBatchList.push(batch)
        batch = {}
      }
      batch[link] = source
    })

    if (Object.keys(batch).length > 0) this._modBatchList.push(batch)
  }

  async run (scheduleAssignmentOnly) {
    if (this.inProgress) {
      if (!config.advanced.forkBatches) {
        log.cycle.warning(`Previous ${this.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.name !== 'default' ? ' (' + this.name + ') ' : ''} was unable to finish, attempting to start new cycle. If repeatedly seeing this message, consider increasing your refresh time.`)
        this.inProgress = false
      } else {
        log.cycle.warning(`${this.SHARD_ID}Schedule ${this.name} - Processors from previous cycle were not killed (${this._processorList.length}). Killing all processors now. If repeatedly seeing this message, consider increasing your refresh time.`)
        for (var x in this._processorList) {
          this._processorList[x].kill()
        }
        this._processorList = []
      }
    }
    this.vipServers = []
    this.vipServerLimits = {}
    this.allowWebhooks = {}

    if (config._vip === true) {
      const vipUsers = await dbOps.vips.getAll()
      for (const vipUser of vipUsers) {
        for (const serverId of vipUser.servers) {
          if (vipUser.invalid !== true) this.allowWebhooks[serverId] = true
          if (vipUser.invalid === true) continue
          this.vipServers.push(serverId)
          if (vipUser.maxFeeds) this.vipServerLimits[serverId] = vipUser.maxFeeds
        }
      }
    }

    const failedLinks = await dbOps.failedLinks.getAll()
    failedLinks.forEach(item => {
      this.failedLinks[item.link] = item.failed || item.count
    })
    const guildRssList = await dbOps.guildRss.getAll()
    this._cookieServers = storage.cookieServers
    this._startTime = new Date()
    this._regBatchList = []
    this._modBatchList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    storage.deletedFeeds.length = 0

    this._modSourceList.clear() // Regenerate source lists on every cycle to account for changes to guilds
    this._sourceList.clear()
    let feedCount = 0 // For statistics in storage
    guildRssList.forEach(guildRss => {
      if (!this.bot.guilds.has(guildRss.id)) return
      feedCount += this._addToSourceLists(guildRss, scheduleAssignmentOnly) // Returns the feed count for this guildRss
    })
    if (scheduleAssignmentOnly) return

    this.inProgress = true
    this.feedCount = feedCount
    this._genBatchLists()

    if (this._sourceList.size + this._modSourceList.size === 0) {
      this.inProgress = false
      return this._finishCycle(true)
    }

    if (config.advanced.forkBatches) this._getBatchParallel()
    else this._getBatch(0, this._regBatchList, 'regular')
  }

  _getBatch (batchNumber, batchList, type) {
    if (batchList.length === 0) return this._getBatch(0, this._modBatchList, 'modded')
    const currentBatch = batchList[batchNumber]
    const currentBatchLen = Object.keys(batchList[batchNumber]).length
    let completedLinks = 0

    for (var link in currentBatch) {
      const rssList = currentBatch[link]
      let uniqueSettings
      for (var modRssName in rssList) {
        if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
          uniqueSettings = rssList[modRssName].advanced
        }
      }

      getArticles({ config: config, feedData: this.feedData, link: link, rssList: rssList, uniqueSettings: uniqueSettings, runNum: this.ran, scheduleName: this.name }, (err, linkCompletion) => {
        if (err) log.cycle.warning(`Skipping ${linkCompletion.link}`, err)
        if (linkCompletion.status === 'article') {
          if (debugFeeds.includes(linkCompletion.article.rssName)) log.debug.info(`${linkCompletion.article.rssName}: Emitted article event.`)
          return this.emit('article', linkCompletion.article)
        }
        if (linkCompletion.status === 'failed') {
          ++this._cycleFailCount
          if (this.failedLinks[linkCompletion.link] >= FAIL_LIMIT) dbOps.failedLinks.fail(linkCompletion.link).catch(err => log.cycle.warning(`Unable to fail failed link ${linkCompletion.link}`, err))
          else dbOps.failedLinks.increment(linkCompletion.link, true).catch(err => log.cycle.warning(`Unable to increment failed link ${linkCompletion.link}`, err))
        } else if (linkCompletion.status === 'success') {
          if (this.failedLinks[linkCompletion.link]) dbOps.failedLinks.reset(linkCompletion.link).catch(err => log.cycle.warning(`Unable to reset failed link ${linkCompletion.link}`, err))
          if (linkCompletion.feedCollectionId) this.feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection // Only if config.database.uri is a databaseless folder path
        }

        ++this._cycleTotalCount
        ++completedLinks
        if (completedLinks === currentBatchLen) {
          if (batchNumber !== batchList.length - 1) setTimeout(this._getBatch.bind(this), 200, batchNumber + 1, batchList, type)
          else if (type === 'regular' && this._modBatchList.length > 0) setTimeout(this._getBatch.bind(this), 200, 0, this._modBatchList, 'modded')
          else return this._finishCycle()
        }
      })
    }
  }

  _getBatchParallel () {
    const totalBatchLengths = this._regBatchList.length + this._modBatchList.length
    let completedBatches = 0

    let willCompleteBatch = 0
    let regIndices = []
    let modIndices = []

    function deployProcessor (batchList, index, callback) {
      if (!batchList) return
      let completedLinks = 0
      const currentBatch = batchList[index]
      const currentBatchLen = Object.keys(currentBatch).length
      this._processorList.push(childProcess.fork('./rss/isolatedMethod.js'))

      const processorIndex = this._processorList.length - 1
      const processor = this._processorList[processorIndex]

      processor.on('message', linkCompletion => {
        if (linkCompletion.status === 'article') return this.emit('article', linkCompletion.article)
        if (linkCompletion.status === 'batch_connected' && callback) return callback() // Spawn processor for next batch
        if (linkCompletion.status === 'failed') {
          ++this._cycleFailCount
          if (this.failedLinks[linkCompletion.link] >= FAIL_LIMIT) dbOps.failedLinks.fail(linkCompletion.link).catch(err => log.cycle.warning(`Unable to fail failed link ${linkCompletion.link}`, err))
          else dbOps.failedLinks.increment(linkCompletion.link, true).catch(err => log.cycle.warning(`Unable to increment failed link ${linkCompletion.link}`, err))
        } else if (linkCompletion.status === 'success') {
          if (this.failedLinks[linkCompletion.link]) dbOps.failedLinks.reset(linkCompletion.link).catch(err => log.cycle.warning(`Unable to reset failed link ${linkCompletion.link}`, err))
          if (linkCompletion.feedCollectionId) this.feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection // Only if config.database.uri is a databaseless folder path
        }

        ++this._cycleTotalCount
        ++completedLinks
        if (completedLinks === currentBatchLen) {
          completedBatches++
          processor.kill()
          if (completedBatches === totalBatchLengths) {
            this._processorList.length = 0
            this._finishCycle()
          }
        }
      })

      processor.send({ config: config, feedData: this.feedData, currentBatch: currentBatch, debugFeeds: debugFeeds, shardId: this.bot.shard && this.bot.shard.count > 0 ? this.bot.shard.id : null, runNum: this.ran, scheduleName: this.name })
    }

    function spawn (count) {
      for (var q = 0; q < count; ++q) {
        willCompleteBatch++
        const batchList = regIndices.length > 0 ? this._regBatchList : modIndices.length > 0 ? this._modBatchList : undefined
        const index = regIndices.length > 0 ? regIndices.shift() : modIndices.length > 0 ? modIndices.shift() : undefined
        deployProcessor.bind(this)(batchList, index, () => {
          if (willCompleteBatch < totalBatchLengths) spawn.bind(this)(1)
        })
      }
    }

    if (config.advanced.parallelBatches > 0) {
      for (var g = 0; g < this._regBatchList.length; ++g) regIndices.push(g)
      for (var h = 0; h < this._modBatchList.length; ++h) modIndices.push(h)
      spawn.bind(this)(config.advanced.parallelBatches)
    } else {
      for (var i = 0; i < this._regBatchList.length; ++i) { deployProcessor.bind(this)(this._regBatchList, i) }
      for (var y = 0; y < this._modBatchList.length; ++y) { deployProcessor.bind(this)(this._modBatchList, y) }
    }
  }

  killChildren () {
    for (var x of this._processorList) x.kill()
    this._processorList = []
  }

  _finishCycle (noFeeds) {
    if (this.bot.shard && this.bot.shard.count > 0) {
      process.send({ _drss: true, type: 'scheduleComplete', refreshTime: this.refreshTime })
    }
    const diff = (new Date() - this._startTime) / 1000
    const timeTaken = diff.toFixed(2)

    if (noFeeds) log.cycle.info(`${this.SHARD_ID}Finished ${this.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.name !== 'default' ? ' (' + this.name + ')' : ''}. No feeds to retrieve`)
    else {
      if (this._processorList.length === 0) this.inProgress = false
      this.emit('finish')
      log.cycle.info(`${this.SHARD_ID}Finished ${this.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.name !== 'default' ? ' (' + this.name + ')' : ''}${this._cycleFailCount > 0 ? ' (' + this._cycleFailCount + '/' + this._cycleTotalCount + ' failed)' : ''}. Cycle Time: ${timeTaken}s`)
    }

    ++this.ran

    if (!config.database.uri.startsWith('mongo')) return
    // Update statistics
    dbOps.statistics.update({
      shard: this.bot.shard && this.bot.shard.count > 0 ? this.bot.shard.id : 0,
      guilds: this.bot.guilds.size,
      feeds: this.feedCount,
      cycleTime: diff,
      cycleFails: this._cycleFailCount,
      cycleLinks: this._cycleTotalCount,
      lastUpdated: new Date()
    }).catch(err => log.general.warning('Unable to update statistics after cycle', err))
  }

  stop () {
    clearInterval(this._timer)
    if (this._timer) log.cycle.info(`Schedule '${this.name}' has stopped`)
  }

  start () {
    if (!this.bot.shard || this.bot.shard.count === 0) this._timer = setInterval(this.run, this.refreshTime * 60000)
  }
}

module.exports = FeedSchedule

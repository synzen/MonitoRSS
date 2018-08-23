const getArticles = require('../rss/singleMethod.js')
const config = require('../config.json')
const configChecks = require('../util/configCheck.js')
const dbOps = require('../util/dbOps.js')
const debugFeeds = require('../util/debugFeeds.js').list
const events = require('events')
const childProcess = require('child_process')
const storage = require('../util/storage.js') // All properties of storage must be accessed directly due to constant changes
const statistics = storage.statistics
const log = require('../util/logger.js')
const BATCH_SIZE = config.advanced.batchSize

class FeedSchedule {
  constructor (bot, schedule, feedData) {
    if (!schedule.refreshTimeMinutes) throw new Error('No refreshTimeMinutes has been declared for a schedule')
    if (schedule.name !== 'default' && (!Array.isArray(schedule.keywords) || schedule.keywords.length === 0)) throw new Error(`Invalid/empty keywords array for nondefault schedule (name: ${schedule.name})`)
    this.SHARD_ID = bot.shard && bot.shard.count > 0 ? 'SH ' + bot.shard.id + ' ' : ''
    this.bot = bot
    this.schedule = schedule
    this.refreshTime = this.schedule.refreshTimeMinutes
    this.cycle = new events.EventEmitter()
    this._cookieServers = storage.cookieServers
    this._processorList = []
    this._regBatchList = []
    this._modBatchList = [] // Batch of sources with cookies
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._sourceList = new Map()
    this._modSourceList = new Map()
    this.feedData = feedData // Object of collection ids as keys, and arrays of objects as values

    if (!this.bot.shard || this.bot.shard.count === 0) {
      this._timer = setInterval(this.run.bind(this), this.refreshTime * 60000) // Only create an interval for itself if there is no sharding
      log.cycle.info(`${this.SHARD_ID}Schedule '${this.schedule.name}' has begun`)
    }
  }

  _verifyCookieUse (id, advanced) {
    if (this._cookieServers.includes(id)) return true
    delete advanced.cookies
    return false
  }

  _delegateFeed (guildRss, rssName) {
    const source = guildRss.sources[rssName]

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

  _addToSourceLists (guildRss) { // rssList is an object per guildRss
    const rssList = guildRss.sources
    let c = 0 // To count and determine what feeds should be disabled if they violate their limits
    const max = !storage.vipServers[guildRss.id] ? config.feeds.max : storage.vipServers[guildRss.id] && storage.vipServers[guildRss.id].benefactor.maxFeeds ? storage.vipServers[guildRss.id].benefactor.maxFeeds : 0
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

      if (configChecks.checkExists(rssName, guildRss, false) && configChecks.validChannel(this.bot, guildRss, rssName) && typeof storage.failedLinks[source.link] !== 'string') {
        if (storage.scheduleAssigned[rssName] === this.schedule.name) { // If assigned to a this.schedule
          this._delegateFeed(guildRss, rssName)
        } else if (this.schedule.name !== 'default' && !storage.scheduleAssigned[rssName]) { // If current feed this.schedule is a custom one and is not assigned
          this.schedule.keywords.forEach(word => {
            if (source.link.includes(word)) {
              storage.scheduleAssigned[rssName] = this.schedule.name // Assign this feed to this this.schedule so no other feed this.schedule can take it on subsequent cycles
              this._delegateFeed(guildRss, rssName)
              log.cycle.info(`Undelegated feed ${rssName} (${source.link}) has been delegated to custom schedule ${this.schedule.name}`)
            }
          })
        } else if (!storage.scheduleAssigned[rssName]) { // Has no this.schedule, was not previously assigned, so see if it can be assigned to default
          let reserved = false
          storage.allScheduleWords.forEach(item => { // If it can't be assigned to default, it will eventually be assigned to other schedules when they occur
            if (source.link.includes(item)) reserved = true
          })
          if (!reserved) {
            storage.scheduleAssigned[rssName] = 'default'
            this._delegateFeed(guildRss, rssName)
          }
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

  run () {
    if (this.inProgress) {
      if (!config.advanced.processorMethod || config.advanced.processorMethod === 'single') {
        log.cycle.warning(`Previous ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ') ' : ''} was unable to finish, attempting to start new cycle. If repeatedly seeing this message, consider increasing your refresh time.`)
        this.inProgress = false
      } else {
        log.cycle.warning(`${this.SHARD_ID}Schedule ${this.schedule.name} - Processors from previous cycle were not killed (${this._processorList.length}). Killing all processors now. If repeatedly seeing this message, consider increasing your refresh time.`)
        for (var x in this._processorList) {
          this._processorList[x].kill()
        }
        this._processorList = []
      }
    }
    const currentGuilds = storage.currentGuilds
    this._cookieServers = storage.cookieServers
    this._startTime = new Date()
    this.inProgress = true
    this._regBatchList = []
    this._modBatchList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    storage.deletedFeeds.length = 0

    this._modSourceList.clear() // Regenerate source lists on every cycle to account for changes to guilds
    this._sourceList.clear()
    let feedCount = 0 // For statistics in storage
    currentGuilds.forEach(guildRss => {
      feedCount += this._addToSourceLists(guildRss) // Returns the feed count for this guildRss
    })
    storage.statistics.feeds = feedCount
    this._genBatchLists()

    if (this._sourceList.size + this._modSourceList.size === 0) {
      this.inProgress = false
      return this._finishCycle(true)
    }

    switch (config.advanced.processorMethod) {
      case 'concurrent':
        this._getBatch(0, this._regBatchList, 'regular')
        break
      case 'concurrent-isolated':
        this._getBatchIsolated(0, this._regBatchList, 'regular')
        break
      case 'parallel-isolated':
        this._getBatchParallel()
    }
  }

  _getBatch (batchNumber, batchList, type) {
    const failedLinks = storage.failedLinks
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

      getArticles({ config: config, feedData: this.feedData, link: link, rssList: rssList, uniqueSettings: uniqueSettings, logicType: 'cycle' }, (err, linkCompletion) => {
        if (err) log.cycle.warning(`Skipping ${linkCompletion.link}`, err)
        if (linkCompletion.status === 'article') {
          if (debugFeeds.includes(linkCompletion.article.rssName)) log.debug.info(`${linkCompletion.article.rssName}: Emitted article event.`)
          return this.cycle.emit('article', linkCompletion.article)
        }
        if (linkCompletion.status === 'failed') {
          ++this._cycleFailCount
          dbOps.failedLinks.increment(linkCompletion.link, true).catch(err => log.cycle.warning(`Unable to increment failed link ${linkCompletion.link}`, err))
        } else if (linkCompletion.status === 'success') {
          if (failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]
          if (linkCompletion.feedCollectionId) this.feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection // Only if config.database.uri is a databaseless folder path
        }

        ++this._cycleTotalCount
        if (++completedLinks === currentBatchLen) {
          if (batchNumber !== batchList.length - 1) setTimeout(this._getBatch.bind(this), 200, batchNumber + 1, batchList, type)
          else if (type === 'regular' && this._modBatchList.length > 0) setTimeout(this._getBatch.bind(this), 200, 0, this._modBatchList, 'modded')
          else return this._finishCycle()
        }
      })
    }
  }

  _getBatchIsolated (batchNumber, batchList, type) {
    const failedLinks = storage.failedLinks
    if (batchList.length === 0) return this._getBatchIsolated(0, this._modBatchList, 'modded')
    const currentBatch = batchList[batchNumber]
    const currentBatchLen = Object.keys(currentBatch).length
    let completedLinks = 0

    this._processorList.push(childProcess.fork('./rss/isolatedMethod.js'))

    const processorIndex = this._processorList.length - 1
    const processor = this._processorList[processorIndex]

    processor.on('message', linkCompletion => {
      if (linkCompletion.status === 'article') return this.cycle.emit('article', linkCompletion.article)
      if (linkCompletion.status === 'batch_connected') return // Only used for parallel
      if (linkCompletion.status === 'failed') {
        ++this._cycleFailCount
        dbOps.failedLinks.increment(linkCompletion.link, true).catch(err => log.cycle.warning(`Unable to increment failed link ${linkCompletion.link}`, err))
      } else if (linkCompletion.status === 'success') {
        if (failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]
        if (linkCompletion.feedCollectionId) this.feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection // Only if config.database.uri is a databaseless folder path
      }

      this._cycleTotalCount++
      if (++completedLinks === currentBatchLen) {
        processor.kill()
        this._processorList.splice(processorIndex, 1)
        if (batchNumber !== batchList.length - 1) setTimeout(this._getBatchIsolated.bind(this), 200, batchNumber + 1, batchList, type)
        else if (type === 'regular' && this._modBatchList.length > 0) setTimeout(this._getBatchIsolated.bind(this), 200, 0, this._modBatchList, 'modded')
        else this._finishCycle()
      }
    })

    processor.send({ config: config, feedData: this.feedData, currentBatch: currentBatch, debugFeeds: debugFeeds, shardId: this.bot.shard && this.bot.shard.count > 0 ? this.bot.shard.id : null, logicType: 'cycle' })
  }

  _getBatchParallel () {
    const failedLinks = storage.failedLinks
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
        if (linkCompletion.status === 'article') return this.cycle.emit('article', linkCompletion.article)
        if (linkCompletion.status === 'batch_connected') return callback() // Spawn processor for next batch
        if (linkCompletion.status === 'failed') {
          ++this._cycleFailCount
          dbOps.failedLinks.increment(linkCompletion.link, true).catch(err => log.cycle.warning(`Unable to increment failed link ${linkCompletion.link}`, err))
        } else if (linkCompletion.status === 'success') {
          if (failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]
          if (linkCompletion.feedCollectionId) this.feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection // Only if config.database.uri is a databaseless folder path
        }

        ++this._cycleTotalCount
        if (++completedLinks === currentBatchLen) {
          completedBatches++
          processor.kill()
          if (completedBatches === totalBatchLengths) {
            this._processorList.length = 0
            this._finishCycle()
          }
        }
      })

      processor.send({ config: config, feedData: this.feedData, currentBatch: currentBatch, debugFeeds: debugFeeds, shardId: this.bot.shard && this.bot.shard.count > 0 ? this.bot.shard.id : null, logicType: 'cycle' })
    }

    function spawn (count) {
      for (var q = 0; q < count; ++q) {
        willCompleteBatch++
        deployProcessor.bind(this)(regIndices.length > 0 ? this._regBatchList : modIndices.length > 0 ? this._modBatchList : undefined, regIndices.length > 0 ? regIndices.shift() : modIndices.length > 0 ? modIndices.shift() : undefined, () => {
          if (willCompleteBatch < totalBatchLengths) spawn.bind(this)(1)
        })
      }
    }

    if (config.advanced.parallel && config.advanced.parallel > 1) {
      for (var g = 0; g < this._regBatchList.length; ++g) regIndices.push(g)
      for (var h = 0; h < this._modBatchList.length; ++h) modIndices.push(h)
      spawn.bind(this)(config.advanced.parallel)
    } else {
      for (var i = 0; i < this._regBatchList.length; ++i) { deployProcessor.bind(this)(this._regBatchList, i) }
      for (var y = 0; y < this._modBatchList.length; ++y) { deployProcessor.bind(this)(this._modBatchList, y) }
    }
  }

  _finishCycle (noFeeds) {
    if (this.bot.shard && this.bot.shard.count > 0) {
      dbOps.failedLinks.uniformize(storage.failedLinks).catch(err => log.cycle.error('Unable to uniformize failed links at end of cycle', err)) // Update failedLinks across all shards
      process.send({ _drss: true, type: 'scheduleComplete', refreshTime: this.refreshTime })
    }
    const diff = (new Date() - this._startTime) / 1000
    const timeTaken = diff.toFixed(2)

    if (noFeeds) log.cycle.info(`${this.SHARD_ID}Finished ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ')' : ''}. No feeds to retrieve`)
    else {
      if (this._processorList.length === 0) this.inProgress = false
      this.cycle.emit('finish')
      log.cycle.info(`${this.SHARD_ID}Finished ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ')' : ''}${this._cycleFailCount > 0 ? ' (' + this._cycleFailCount + '/' + this._cycleTotalCount + ' failed)' : ''}. Cycle Time: ${timeTaken}s`)
    }

    // Update statistics
    if (this.schedule.name === 'default') {
      // statistics.feeds is handled earlier in run()
      statistics.guilds = this.bot.guilds.size
      statistics.cycleTime = !statistics.cycleTime ? diff : (diff + statistics.cycleTime) / 2
      statistics.cycleFails = !statistics.cycleFails ? this._cycleFailCount : (statistics.cycleFails + this._cycleFailCount) / 2
      statistics.cycleLinks = !statistics.cycleLinks ? this._cycleTotalCount : (statistics.cycleLinks + this._cycleTotalCount) / 2
      statistics.fullyUpdated = true
      statistics.lastUpdated = new Date()
    }

    if (this.schedule.name === 'default' && this.bot.shard && this.bot.shard.count > 0) {
      this.bot.shard.broadcastEval(`
        const storage = require(require('path').dirname(require.main.filename) + '/util/storage.js')
        const obj = {}
        obj.cycleLinks = storage.statistics.cycleLinks
        obj.cycleTime = storage.statistics.cycleTime
        obj.cycleFails = storage.statistics.cycleFails
        obj.feeds = storage.statistics.feeds
        obj.guilds = this.guilds.size
        obj
      `).then(results => {
        let globalCycleLinks = 0
        let globalCycleTime = 0
        let globalCycleFails = 0
        let globalFeeds = 0
        let globalGuilds = 0
        for (var i = 0; i < results.length; ++i) {
          const result = results[i]
          if (result.cycleLinks != null) globalCycleLinks += result.cycleLinks
          if (result.cycleTime != null) globalCycleTime += result.cycleTime
          if (result.cycleFails != null) globalCycleFails += result.cycleFails
          globalFeeds += result.feeds
          globalGuilds += result.guilds
        }
        this.bot.shard.broadcastEval(`
          const storage = require(require('path').dirname(require.main.filename) + '/util/storage.js')
          const shardCount = this.shard.count
          storage.statisticsGlobal.guilds = { global: ${globalGuilds}, shard: ${globalGuilds} / shardCount }
          storage.statisticsGlobal.feeds = { global: ${globalFeeds}, shard: ${globalFeeds} / shardCount }
          if (${globalCycleTime}) {
            storage.statisticsGlobal.lastUpdated = new Date()
            if (storage.statisticsGlobal.fullyUpdated !== true) {
              ++storage.statisticsGlobal.fullyUpdated
              if (storage.statisticsGlobal.fullyUpdated >= shardCount) storage.statisticsGlobal.fullyUpdated = true
            }
            storage.statisticsGlobal.cycleLinks = { global: ${globalCycleLinks}, shard: ${globalCycleLinks} / shardCount }
            storage.statisticsGlobal.cycleTime = { global: ${globalCycleTime}, shard: ${globalCycleTime} / shardCount }
            storage.statisticsGlobal.cycleFails = { global: ${globalCycleFails}, shard: ${globalCycleFails} / shardCount }
          }
        `).catch(err => log.general.warning('Failed to update global statistics', err))
      }).catch(err => log.general.warning('Unable to get individual statistics for update', err))
    }
  }

  stop () {
    clearInterval(this._timer)
    if (this._timer) log.cycle.info(`Schedule '${this.schedule.name}' has stopped`)
  }

  start () {
    if (!this.bot.shard || this.bot.shard.count === 0) this._timer = setInterval(this.run, this.refreshTime * 60000)
  }
}

module.exports = FeedSchedule

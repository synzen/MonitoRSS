const getArticles = require('../rss/cycleSingle.js')
const config = require('../config.json')
const configChecks = require('./configCheck.js')
const dbOps = require('./dbOps.js')
const debugFeeds = require('./debugFeeds.js').list
const events = require('events')
const childProcess = require('child_process')
const storage = require('./storage.js') // All properties of storage must be accessed directly due to constant changes
const logLinkErr = require('./logLinkErrs.js')
const log = require('./logger.js')
const allScheduleWords = storage.allScheduleWords
const BATCH_SIZE = config.advanced.batchSize

class FeedSchedule {
  constructor (bot, schedule) {
    this.SHARD_ID = bot.shard ? 'SH ' + bot.shard.id + ' ' : ''
    this.bot = bot
    this.schedule = schedule
    this.refreshTime = this.schedule.refreshTimeMinutes ? this.schedule.refreshTimeMinutes : config.feeds.refreshTimeMinutes
    this.cycle = new events.EventEmitter()
    this._cookieServers = storage.cookieServers
    this._processorList = []
    this._regBatchList = []
    this._modBatchList = [] // Batch of sources with cookies
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._sourceList = new Map()
    this._modSourceList = new Map()
    // this._leftoverBatch = new Map() // Batch of failed links to merge into the batchLists after each cycle for second retry

    if (!this.bot.shard || (this.bot.shard && this.bot.shard.count === 1)) {
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
    let c = 0
    const max = storage.limitOverrides[guildRss.id] || (config.feeds.max || 0)
    const status = {}
    for (var rssName in rssList) {
      const source = rssList[rssName]

      // Determine whether any feeds should be disabled
      if (++c <= max && source.disabled === true) {
        log.general.info(`Enabling feed named ${rssName} for server ${guildRss.id}...`)
        dbOps.guildRss.enableFeed(guildRss, rssName, null, true)
        if (!status[source.channel]) status[source.channel] = { enabled: [], disabled: [] }
        status[source.channel].enabled.push(source.link)
      } else if (c > max && source.disabled !== true) {
        log.general.warning(`Disabling feed named ${rssName} for server ${guildRss.id}...`)
        dbOps.guildRss.disableFeed(guildRss, rssName, null, true)
        if (!status[source.channel]) status[source.channel] = { enabled: [], disabled: [] }
        status[source.channel].disabled.push(source.link)
      }

      if (configChecks.checkExists(rssName, source, false) && configChecks.validChannel(this.bot, guildRss, rssName) && typeof storage.failedLinks[source.link] !== 'string') {
        if (storage.linkTracker[rssName] === this.schedule.name) { // If assigned to a this.schedule
          this._delegateFeed(guildRss, rssName)
        } else if (this.schedule.name !== 'default' && !storage.linkTracker[rssName]) { // If current feed this.schedule is a custom one and is not assigned
          this.schedule.keywords.forEach(word => {
            if (source.link.includes(word)) {
              storage.linkTracker[rssName] = this.schedule.name // Assign this feed to this this.schedule so no other feed this.schedule can take it on subsequent cycles
              this._delegateFeed(guildRss, rssName)
              log.cycle.info(`Undelegated feed ${rssName} (${source.link}) has been delegated to custom schedule ${this.schedule.name}`)
            }
          })
        } else if (!storage.linkTracker[rssName]) { // Has no this.schedule, was not previously assigned, so see if it can be assigned to default
          let reserved = false
          allScheduleWords.forEach(item => { // If it can't be assigned to default, it will eventually be assigned to other schedules when they occur
            if (source.link.includes(item)) reserved = true
          })
          if (!reserved) {
            storage.linkTracker[rssName] = 'default'
            this._delegateFeed(guildRss, rssName)
          }
        }
      }
    }

    // Send notices about any feeds that were enabled/disabled
    if (config._skipMessages === true) return
    for (var channelId in status) {
      let m = '**ATTENTION** - The following changes have been made due to a feed limit change for this server:\n\n'
      const enabled = status[channelId].enabled
      const disabled = status[channelId].disabled
      if (enabled.length === 0 && disabled.length === 0) continue
      for (var a = 0; a < enabled.length; ++a) m += `Feed <${enabled[a]}> has been enabled.\n`
      for (var b = 0; b < disabled.length; ++b) m += `Feed <${disabled[b]}> has been disabled.\n`
      const channel = this.bot.channels.get(channelId)
      if (channel) {
        channel.send(m)
        .then(m => log.general.info(`Sent feed enable/disable notice to server`, channel.guild, channel))
        .catch(err => log.general.warning('Unable to send feed enable/disable notice', channel.guild, channel, err))
      }
    }
  }

  _genBatchLists () { // Each batch is a bunch of links. Too many links at once will cause request failures.
    let batch = new Map()

    this._sourceList.forEach((rssList, link) => { // rssList per link
      if (batch.size >= BATCH_SIZE) {
        this._regBatchList.push(batch)
        batch = new Map()
      }
      batch.set(link, rssList)
    })

    if (batch.size > 0) this._regBatchList.push(batch)

    batch = new Map()

    this._modSourceList.forEach((source, link) => { // One RSS source per link instead of an rssList
      if (batch.size >= BATCH_SIZE) {
        this._modBatchList.push(batch)
        batch = new Map()
      }
      batch.set(link, source)
    })

    if (batch.size > 0) this._modBatchList.push(batch)
  }

  run () {
    if (this.inProgress) {
      if (!config.advanced.processorMethod || config.advanced.processorMethod === 'single') {
        log.cycle.warning(`Previous ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ') ' : ''} was unable to finish, attempting to start new cycle. If repeatedly seeing this message, consider increasing your refresh time.`)
        this.inProgress = false
      } else {
        log.cycle.warning(`${this.SHARD_ID}Processors from previous cycle were not killed (${this._processorList.length}). Killing all processors now. If repeatedly seeing this message, consider increasing your refresh time.`)
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
    currentGuilds.forEach(item => this._addToSourceLists(item))
    this._genBatchLists()

    if (this._sourceList.size + this._modSourceList.size === 0) {
      this.inProgress = false
      return this._finishCycle(true)
    }

    switch (config.advanced.processorMethod) {
      case 'single':
        this._getBatch(0, this._regBatchList, 'regular')
        break
      case 'isolated':
        this._getBatchIsolated(0, this._regBatchList, 'regular')
        break
      case 'parallel':
        this._getBatchParallel()
    }
  }

  _getBatch (batchNumber, batchList, type) {
    const failedLinks = storage.failedLinks
    if (batchList.length === 0) return this._getBatch(0, this._modBatchList, 'modded')
    const currentBatch = batchList[batchNumber]
    let completedLinks = 0

    currentBatch.forEach((rssList, link) => {
      var uniqueSettings
      for (var modRssName in rssList) {
        if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
          uniqueSettings = rssList[modRssName].advanced
        }
      }

      getArticles({ link: link, rssList: rssList, uniqueSettings: uniqueSettings }, (err, linkCompletion) => {
        if (err) logLinkErr({ link: linkCompletion.link, content: err })
        if (linkCompletion.status === 'article') {
          if (debugFeeds.includes(linkCompletion.article.rssName)) log.debug.info(`${linkCompletion.article.rssName}: Emitted article event.`)
          return this.cycle.emit('article', linkCompletion.article)
        }
        if (linkCompletion.status === 'failed') {
          ++this._cycleFailCount
          dbOps.failedLinks.increment(linkCompletion.link, linkCompletion.rssList)
        } else if (linkCompletion.status === 'success' && failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]

        ++this._cycleTotalCount
        if (++completedLinks === currentBatch.size) {
          if (batchNumber !== batchList.length - 1) setTimeout(this._getBatch.bind(this), 200, batchNumber + 1, batchList, type)
          else if (type === 'regular' && this._modBatchList.length > 0) setTimeout(this._getBatch.bind(this), 200, 0, this._modBatchList, 'modded')
          else return this._finishCycle()
        }
      })
    })
  }

  _getBatchIsolated (batchNumber, batchList, type) {
    const failedLinks = storage.failedLinks
    if (batchList.length === 0) return this._getBatchIsolated(0, this._modBatchList, 'modded')
    const currentBatch = batchList[batchNumber]
    let completedLinks = 0

    this._processorList.push(childProcess.fork('./rss/cycleProcessor.js'))

    const processorIndex = this._processorList.length - 1
    const processor = this._processorList[processorIndex]

    currentBatch.forEach((rssList, link) => {
      let uniqueSettings
      for (var modRssName in rssList) {
        if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
          uniqueSettings = rssList[modRssName].advanced
        }
      }
      processor.send({type: 'initial', link: link, rssList: rssList, uniqueSettings: uniqueSettings, debugFeeds: debugFeeds, shardId: this.bot.shard ? this.bot.shard.id : null})
    })

    processor.on('message', linkCompletion => {
      if (linkCompletion.status === 'article') return this.cycle.emit('article', linkCompletion.article)
      if (linkCompletion.status === 'failed') {
        ++this._cycleFailCount
        dbOps.failedLinks.increment(linkCompletion.link, linkCompletion.rssList)
      } else if (linkCompletion.status === 'success' && failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]

      this._cycleTotalCount++
      if (++completedLinks === currentBatch.size) {
        processor.kill()
        this._processorList.splice(processorIndex, 1)
        if (batchNumber !== batchList.length - 1) setTimeout(this._getBatchIsolated.bind(this), 200, batchNumber + 1, batchList, type)
        else if (type === 'regular' && this._modBatchList.length > 0) setTimeout(this._getBatchIsolated.bind(this), 200, 0, this._modBatchList, 'modded')
        else this._finishCycle()
      }
    })
  }

  _getBatchParallel () {
    const failedLinks = storage.failedLinks
    const totalBatchLengths = this._regBatchList.length + this._modBatchList.length
    let completedBatches = 0

    function deployProcessor (batchList, index) {
      let completedLinks = 0
      const currentBatch = batchList[index]
      this._processorList.push(childProcess.fork('./rss/cycleProcessor.js'))

      const processorIndex = this._processorList.length - 1
      const processor = this._processorList[processorIndex]

      processor.on('message', linkCompletion => {
        if (linkCompletion.status === 'article') return this.cycle.emit('article', linkCompletion.article)
        if (linkCompletion.status === 'failed') {
          ++this._cycleFailCount
          dbOps.failedLinks.increment(linkCompletion.link, linkCompletion.rssList)
        } else if (linkCompletion.status === 'success' && failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]

        ++this._cycleTotalCount
        if (++completedLinks === currentBatch.size) {
          completedBatches++
          processor.kill()
          if (completedBatches === totalBatchLengths) {
            this._processorList = []
            this._finishCycle()
          }
        }
      })

      currentBatch.forEach((rssList, link) => {
        var uniqueSettings
        for (var modRssName in rssList) {
          if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
            uniqueSettings = rssList[modRssName].advanced
          }
        }
        processor.send({type: 'initial', link: link, rssList: rssList, uniqueSettings: uniqueSettings, debugFeeds: debugFeeds, shardId: this.bot.shard ? this.bot.shard.id : null})
      })
    }

    for (var i = 0; i < this._regBatchList.length; ++i) { deployProcessor.bind(this)(this._regBatchList, i) }
    for (var y = 0; y < this._modBatchList.length; ++y) { deployProcessor.bind(this)(this._modBatchList, y) }
  }

  _finishCycle (noFeeds) {
    if (this.bot.shard && this.bot.shard.count > 1) this.bot.shard.send({ type: 'scheduleComplete', refreshTime: this.refreshTime })
    if (noFeeds) return log.cycle.info(`${this.SHARD_ID}Finished ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ')' : ''}. No feeds to retrieve`)

    if (this._processorList.length === 0) this.inProgress = false

    const timeTaken = ((new Date() - this._startTime) / 1000).toFixed(2)
    log.cycle.info(`${this.SHARD_ID}Finished ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ')' : ''}${this._cycleFailCount > 0 ? ' (' + this._cycleFailCount + '/' + this._cycleTotalCount + ' failed)' : ''}. Cycle Time: ${timeTaken}s`)
    if (this.bot.shard && this.bot.shard.count > 1) this.bot.shard.send({type: 'scheduleComplete', refreshTime: this.refreshTime})
  }

  stop () {
    clearInterval(this._timer)
    if (this._timer) log.cycle.info(`Schedule '${this.schedule.name}' has stopped`)
  }

  start () {
    if (!this.bot.shard || (this.bot.shard && this.bot.shard.count === 1)) this._timer = setInterval(this.run, this.refreshTime * 60000)
  }
}

module.exports = FeedSchedule

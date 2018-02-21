const fs = require('fs')
const getArticles = require('../rss/cycleSingle.js')
const config = require('../config.json')
const configChecks = require('./configCheck.js')
const debugFeeds = require('../util/debugFeeds.js').list
const events = require('events')
const childProcess = require('child_process')
const storage = require('./storage.js') // All properties of storage must be accessed directly due to constant changes
const logLinkErr = require('./logLinkErrs.js')
const allScheduleWords = storage.allScheduleWords
const FAIL_LIMIT = config.feedSettings.failLimit
const WARN_LIMIT = Math.floor(config.feedSettings.failLimit * 0.75) < FAIL_LIMIT ? Math.floor(config.feedSettings.failLimit * 0.75) : Math.floor(config.feedSettings.failLimit * 0.5) < FAIL_LIMIT ? Math.floor(config.feedSettings.failLimit * 0.5) : 0
const BATCH_SIZE = config.advanced.batchSize

function reachedFailCount (link) {
  return typeof storage.failedLinks[link] === 'string' // string indicates it has reached the fail count, and is the date of when it failed
}
class FeedSchedule {
  constructor (bot, schedule) {
    this.SHARD_ID = bot.shard ? 'SH ' + bot.shard.id + ' ' : ''
    this.bot = bot
    this.schedule = schedule
    this.refreshTime = this.schedule.refreshTimeMinutes ? this.schedule.refreshTimeMinutes : config.feedSettings.refreshTimeMinutes
    this.cycle = new events.EventEmitter()
    this._processorList = []
    this._regBatchList = []
    this._modBatchList = [] // Batch of sources with cookies
    this._cycleFailCount = 0
    this._cycleTotalCount = 0
    this._sourceList = new Map()
    this._modSourceList = new Map()

    if (!this.bot.shard || (this.bot.shard && this.bot.shard.count === 1)) {
      this._timer = setInterval(this.run.bind(this), this.refreshTime * 60000) // Only create an interval for itself if there is no sharding
      console.log(`${this.SHARD_ID}RSS Info: Schedule '${this.schedule.name}' has begun.`)
    }
  }

  _addFailedFeed (link, rssList) {
    const failedLinks = storage.failedLinks
    storage.failedLinks[link] = (failedLinks[link]) ? failedLinks[link] + 1 : 1

    if (failedLinks[link] === WARN_LIMIT) {
      if (config.feedSettings.notifyFail !== true) return
      for (var i in rssList) {
        const source = rssList[i]
        if (source.link === link) this.bot.channels.get(source.channel).send(`**WARNING** - Feed link <${link}> is nearing the connection failure limit. Once it has failed, it will not be retried until is manually refreshed. See \`${config.botSettings.prefix}rsslist\` for more information.`).catch(err => console.log(`Unable to send reached warning limit for feed ${link} in channel ${source.channel}`, err.message || err))
      }
    } else if (failedLinks[link] >= FAIL_LIMIT) {
      storage.failedLinks[link] = (new Date()).toString()
      console.log(`RSS Error: ${link} has passed the fail limit (${FAIL_LIMIT}). Will no longer retrieve.`)
      if (config.feedSettings.notifyFail !== true) return
      for (var j in rssList) {
        const source = rssList[j]
        if (source.link === link) this.bot.channels.get(source.channel).send(`**ATTENTION** - Feed link <${link}> has reached the connection failure limit and will not be retried until is manually refreshed. See \`${config.botSettings.prefix}rsslist\` for more information. A backup for this server has been provided in case this feed is subjected to forced removal in the future.`).catch(err => console.log(`Unable to send reached failure limit for feed ${link} in channel ${source.channel}`, err.message || err))
      }
    }
  }

  _delegateFeed (guildRss, rssName) {
    const source = guildRss.sources[rssName]

    if (source.advanced && Object.keys(source.advanced).length > 0) { // Special source list for feeds with unique settings defined
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

    for (var rssName in rssList) {
      const source = rssList[rssName]
      if (configChecks.checkExists(rssName, source, false) && configChecks.validChannel(this.bot, guildRss.id, source) && !reachedFailCount(source.link)) {
        if (storage.linkTracker[rssName] === this.schedule.name) { // If assigned to a this.schedule
          this._delegateFeed(guildRss, rssName)
        } else if (this.schedule.name !== 'default' && !storage.linkTracker[rssName]) { // If current feed this.schedule is a custom one and is not assigned
          this.schedule.keywords.forEach(word => {
            if (source.link.includes(word)) {
              storage.linkTracker[rssName] = this.schedule.name // Assign this feed to this this.schedule so no other feed this.schedule can take it on subsequent cycles
              this._delegateFeed(guildRss, rssName)
              console.log(`RSS Info: Undelegated feed ${rssName} (${source.link}) has been delegated to custom this.schedule ${this.schedule.name}`)
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
        console.log(`RSS Info: Previous ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ') ' : ''} was unable to finish, attempting to start new cycle. If repeatedly seeing this message, consider increasing your refresh time.`)
        this.inProgress = false
      } else {
        console.log(`${this.SHARD_ID}Processors from previous cycle were not killed (${this._processorList.length}). Killing all processors now. If repeatedly seeing this message, consider increasing your refresh time.`)
        for (var x in this._processorList) {
          this._processorList[x].kill()
        }
        this._processorList = []
      }
    }
    const currentGuilds = storage.currentGuilds
    this._startTime = new Date()
    this.inProgress = true
    this._regBatchList = []
    this._modBatchList = []
    this._cycleFailCount = 0
    this._cycleTotalCount = 0

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

      getArticles(link, rssList, uniqueSettings, (err, linkCompletion) => {
        if (err) logLinkErr({link: linkCompletion.link, content: err})
        if (linkCompletion.status === 'article') {
          if (debugFeeds.includes(linkCompletion.article.rssName)) console.log(`DEBUG ${linkCompletion.article.rssName}: Emitted article event.`)
          return this.cycle.emit('article', linkCompletion.article)
        }
        if (linkCompletion.status === 'failed' && FAIL_LIMIT !== 0) {
          ++this._cycleFailCount
          this._addFailedFeed(linkCompletion.link, linkCompletion.rssList)
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
      processor.send({type: 'initial', link: link, rssList: rssList, uniqueSettings: uniqueSettings, debugFeeds: debugFeeds})
    })

    processor.on('message', linkCompletion => {
      if (linkCompletion.status === 'article') return this.cycle.emit('article', linkCompletion.article)
      if (linkCompletion.status === 'failed') {
        ++this._cycleFailCount
        if (FAIL_LIMIT !== 0) this._addFailedFeed(linkCompletion.link, linkCompletion.rssList)
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
        if (linkCompletion.status === 'failed' && FAIL_LIMIT !== 0) {
          ++this._cycleFailCount
          this._addFailedFeed(linkCompletion.link, linkCompletion.rssList)
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
        processor.send({type: 'initial', link: link, rssList: rssList, uniqueSettings: uniqueSettings, debugFeeds: debugFeeds})
      })
    }

    for (var i = 0; i < this._regBatchList.length; ++i) { deployProcessor.bind(this)(this._regBatchList, i) }
    for (var y = 0; y < this._modBatchList.length; ++y) { deployProcessor.bind(this)(this._modBatchList, y) }
  }

  _finishCycle (noFeeds) {
    const failedLinks = storage.failedLinks
    if (this.bot.shard && this.bot.shard.count > 1) this.bot.shard.send({type: 'scheduleComplete', refreshTime: this.refreshTime})
    if (noFeeds) return console.log(`${this.SHARD_ID}RSS Info: Finished ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ')' : ''}. No feeds to retrieve.`)

    if (this._processorList.length === 0) this.inProgress = false

    if (this.bot.shard) {
      this.bot.shard.broadcastEval(`require(require('path').dirname(require.main.filename) + '/util/storage.js').failedLinks = JSON.parse('${JSON.stringify(failedLinks)}');`)
      .then(() => {
        try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Unable to update failedLinks.json on end of cycle, reason: ${e}`) }
      })
      .catch(err => console.log(`Error: Unable to broadcast eval failedLinks update on cycle end for shard ${this.bot.shard.id}:`, err.message || err))
    } else try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Unable to update failedLinks.json on end of cycle, reason: ${e}`) }

    var timeTaken = ((new Date() - this._startTime) / 1000).toFixed(2)
    console.log(`${this.SHARD_ID}RSS Info: Finished ${this.schedule.name === 'default' ? 'default ' : ''}feed retrieval cycle${this.schedule.name !== 'default' ? ' (' + this.schedule.name + ')' : ''}${this._cycleFailCount > 0 ? ' (' + this._cycleFailCount + '/' + this._cycleTotalCount + ' failed)' : ''}. Cycle Time: ${timeTaken}s.`)
    if (this.bot.shard && this.bot.shard.count > 1) this.bot.shard.send({type: 'scheduleComplete', refreshTime: this.refreshTime})
  }

  stop () {
    clearInterval(this._timer)
    if (this._timer) console.log(`RSS Info: Schedule '${this.schedule.name}' has stopped.`)
  }

  start () {
    if (!this.bot.shard || (this.bot.shard && this.bot.shard.count === 1)) this._timer = setInterval(this.run, this.refreshTime * 60000)
  }
}

module.exports = FeedSchedule

const FailRecord = require('../structs/db/FailRecord.js')
const ScheduleRun = require('./ScheduleRun.js')
const createLogger = require('../util/logger/create.js')
const EventEmitter = require('events').EventEmitter
const getConfig = require('../config.js').get

/**
 * @typedef {string} FeedURL
 */

/**
 * @typedef {Object<FeedURL, Object<string, any>[]>} MemoryCollection
 */

class ScheduleManager extends EventEmitter {
  constructor () {
    super()
    this.log = createLogger('M')
    this.timers = []
    /**
     * @type {Set<string>}
     */
    this.debugFeedIDs = new Set()
    /**
     * @type {import('./db/Schedule.js')[]}
     * */
    this.schedules = []
    /**
     * @type {import('./ScheduleRun.js')[]}
     * */
    this.scheduleRuns = []
    /**
     * @type {Map<import('./db/Schedule.js'), number>}
     */
    this.scheduleRunCounts = new Map()
    this.urlFailuresRecording = new Set()
    this.urlSuccessesRecording = new Set()
    this.sendingEnabledNotifications = new Set()
    this.sendingDisabledNotifications = new Set()
  }

  async _onNewArticle (newArticle) {
    const { article, feedObject } = newArticle
    const config = getConfig()
    if (config.dev === true) {
      return
    }
    if (this.debugFeedIDs.has(feedObject._id)) {
      this.log.info(`${feedObject._id} ScheduleManager queueing article ${article.link} to send`)
    }
    this.emit('newArticle', newArticle)
  }

  /**
   * Handle fail records in ScheduleManager since multiple
   * runs could be trying to record the same failure at the
   * same time, causing race conditions
   *
   * @param {string} url
   */
  async _onConnectionFailure (url) {
    if (this.urlFailuresRecording.has(url) || this.testRuns) {
      return
    }
    this.urlFailuresRecording.add(url)
    try {
      await FailRecord.record(url)
    } catch (err) {
      this.log.error(err, `Failed to record url fail record ${url}`)
    }
    this.urlFailuresRecording.delete(url)
  }

  /**
   * @param {string} url
   */
  async _onConnectionSuccess (url) {
    if (this.urlSuccessesRecording.has(url) || this.testRuns) {
      return
    }
    this.urlSuccessesRecording.add(url)
    try {
      await FailRecord.reset(url)
    } catch (err) {
      this.log.error(err, `Failed to reset url fail record ${url}`)
    }
    this.urlSuccessesRecording.delete(url)
  }

  /**
   * @param {import('./db/Feed.js')} feed
   */
  async _onFeedDisabled (feed) {
    if (this.sendingDisabledNotifications.has(feed._id)) {
      return
    }
    this.sendingDisabledNotifications.add(feed._id)
    const message = `Feed <${feed.url}> has been disabled in <#${feed.channel}> to due limit changes.`
    this.log.info(`Sending disabled notification for feed ${feed._id} in channel ${feed.channel}`)
    this.emitAlert(feed.channel, message)
    this.sendingDisabledNotifications.delete(feed._id)
  }

  /**
   * @param {import('./db/Feed.js')} feed
   */
  async _onFeedEnabled (feed) {
    if (this.sendingEnabledNotifications.has(feed._id)) {
      return
    }
    this.sendingEnabledNotifications.add(feed._id)
    const message = `Feed <${feed.url}> has been enabled in <#${feed.channel}> to due limit changes.`
    this.log.info(`Sending enabled notification for feed ${feed._id} in channel ${feed.channel}`)
    this.emitAlert(feed.channel, message)
    this.sendingEnabledNotifications.delete(feed._id)
  }

  /**
   * @param {import('./db/FailRecord.js')} record
   */
  async alertFailRecord (record) {
    const url = record._id
    record.alerted = true
    await record.save()
    const feeds = await record.getAssociatedFeeds()
    this.log.info(`Sending fail notification for ${url} to ${feeds.length} channels`)
    feeds.forEach(({ channel }) => {
      const message = `Feed <${url}> in channel <#${channel}> has reached the connection failure limit, and will not be retried until it is manually refreshed by any server using this feed. Use the \`list\` command in your server for more information.`
      this.emitAlert(channel, message)
    })
  }

  /**
   * @param {string} channelID
   * @param {string} message
   */
  emitAlert (channelID, message) {
    this.emit('alert', channelID, message)
  }

  /**
   * Add a schedule and initialize relevant data for it
   *
   * @param {import('./db/Schedule.js')} schedule
   */
  addSchedule (schedule) {
    this.schedules.push(schedule)
    this.scheduleRunCounts.set(schedule, 0)
  }

  /**
   * Add multiple schedules
   *
   * @param {import('./db/Schedule.js')[]} schedules
   */
  addSchedules (schedules) {
    for (const schedule of schedules) {
      this.addSchedule(schedule)
    }
  }

  /**
   * Get current schedule runs of a schedule
   *
   * @param {import('./db/Schedule.js')} schedule
   */
  getRuns (schedule) {
    return this.scheduleRuns.filter(r => r.schedule === schedule)
  }

  /**
   * @param {import('./ScheduleRun.js')} run
   * @param {import('./db/Schedule.js')} schedule
   */
  endRun (run, schedule) {
    run.removeAllListeners()
    this.scheduleRuns.splice(this.scheduleRuns.indexOf(run), 1)
    this.incrementRunCount(schedule)
  }

  /**
   * Terminate a run by killing its children, removing
   * listeners and deleting it from storage
   *
   * @param {import('./ScheduleRun.js')} run
   */
  terminateRun (run) {
    run.terminate()
    this.scheduleRuns.splice(this.scheduleRuns.indexOf(run), 1)
  }

  /**
   * Terminate multiple runs
   *
   * @param {import('./db/Schedule.js')} schedule
   */
  terminateScheduleRuns (schedule) {
    const runs = this.getRuns(schedule)
    runs.forEach(r => this.terminateRun(r))
  }

  /**
   * Check if the number of current runs of a schedule
   * exceeds the max allowed
   *
   * @param {import('./db/Schedule')} schedule
   */
  atMaxRuns (schedule) {
    const maxRuns = getConfig().advanced.parallelRuns
    const runs = this.getRuns(schedule)
    return runs.length === maxRuns
  }

  /**
   * Increment run count of a schedule
   *
   * @param {import('./db/Schedule.js')} schedule
   */
  incrementRunCount (schedule) {
    const counts = this.scheduleRunCounts
    counts.set(schedule, counts.get(schedule) + 1)
  }

  /**
   * Record the failure of hung up URLs
   *
   * @param {string[]} urls
   */
  failURLs (urls) {
    for (const url of urls) {
      FailRecord.record(url)
        .catch(err => this.log.error(err, `Unable to record url failure ${url}`))
    }
  }

  /**
   * Run a schedule
   *
   * @param {import('./db/Schedule.js')} schedule
   */
  async run (schedule) {
    if (this.atMaxRuns(schedule)) {
      const runs = this.getRuns(schedule)
      const hungupURLs = runs.map(run => run.getHungUpURLs())
      this.log.warn({
        urls: hungupURLs
      }, `Previous schedule runs were not finished (${runs.length} run(s)). Terminating all runs. If repeatedly seeing this message, consider increasing your refresh rate.`)
      hungupURLs.forEach((hangups) => this.failURLs(hangups.summary.flat(3)))
      this.terminateScheduleRuns(schedule)
    }
    const runCount = this.scheduleRunCounts.get(schedule)
    const run = new ScheduleRun(schedule, runCount, this.testRuns)
    run.on('newArticle', this._onNewArticle.bind(this))
    run.on('conFailure', this._onConnectionFailure.bind(this))
    run.on('conSuccess', this._onConnectionSuccess.bind(this))
    run.on('alertFail', this.alertFailRecord.bind(this))
    run.on('feedEnabled', this._onFeedEnabled.bind(this))
    run.on('feedDisabled', this._onFeedDisabled.bind(this))
    this.scheduleRuns.push(run)
    try {
      await run.run(this.debugFeedIDs)
      this.endRun(run, schedule)
    } catch (err) {
      this.log.error(err, 'Error during schedule run')
    }
  }

  /**
   * Disable all schedule timers
   */
  clearTimers () {
    if (this.timers.length === 0) {
      return
    }
    this.timers.forEach(timer => clearInterval(timer))
    this.timers.length = 0
  }

  /**
   * Create auto-running schedule timers
   */
  beginTimers () {
    const config = getConfig()
    const immediatelyRun = config.bot.runSchedulesOnStart
    this.clearTimers()
    this.schedules.forEach(schedule => {
      if (immediatelyRun) {
        this.run(schedule)
      }
      this.timers.push(setInterval(() => {
        this.run(schedule)
      }, schedule.refreshRateMinutes * 60000))
    })
  }

  addDebugFeedID (feedID) {
    this.debugFeedIDs.add(feedID)
  }

  removeDebugFeedID (feedID) {
    this.debugFeedIDs.delete(feedID)
  }

  isDebugging (feedID) {
    return this.debugFeedIDs.has(feedID)
  }
}

module.exports = ScheduleManager

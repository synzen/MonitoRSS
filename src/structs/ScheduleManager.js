const FeedSchedule = require('./FeedSchedule.js')
const createLogger = require('../util/logger/create.js')
const EventEmitter = require('events').EventEmitter

class ScheduleManager extends EventEmitter {
  constructor () {
    super()
    this.log = createLogger('M')
    this.schedules = []
    this.timers = []
    this.debugFeedIDs = new Set()
  }

  async _onPendingArticle (pendingArticle) {
    const article = pendingArticle.article
    if (this.debugFeedIDs.has(article._feed._id)) {
      this.log.debug(`${article._feed._id} ScheduleManager queueing article ${article.link} to send`)
    }
    this.emit('pendingArticle', pendingArticle)
  }

  addSchedule (schedule) {
    const feedSchedule = new FeedSchedule(schedule)
    this.schedules.push(feedSchedule)
    feedSchedule.on('pendingArticle', this._onPendingArticle.bind(this))
  }

  addSchedules (schedules) {
    for (const schedule of schedules) {
      this.addSchedule(schedule)
    }
  }

  run (refreshRate) { // Run schedules with respect to their refresh times
    for (var feedSchedule of this.schedules) {
      if (feedSchedule.refreshRate === refreshRate) {
        return feedSchedule.run(this.debugFeedIDs)
          .catch(err => this.log.error(err, `Schedule ${feedSchedule.name} failed to run cycle`))
      }
    }
  }

  getSchedule (name) {
    for (const schedule of this.schedules) {
      if (schedule.name === name) return schedule
    }
  }

  cyclesInProgress (name) {
    for (var feedSchedule of this.schedules.length) {
      if (name && feedSchedule.name === name && feedSchedule.inProgress) return true
      else if (feedSchedule.inProgress) return true
    }
    return false
  }

  clearTimers () {
    if (this.timers.length === 0) {
      return
    }
    this.timers.forEach(timer => clearInterval(timer))
    this.timers.length = 0
  }

  beginTimers () {
    this.clearTimers()
    const rates = new Set()
    this.schedules.forEach(schedule => {
      rates.add(schedule.refreshRate)
    })
    rates.forEach(rate => {
      this.run(rate)
      this.timers.push(setInterval(() => {
        this.run(rate)
      }, rate * 60000))
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

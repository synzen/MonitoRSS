const config = require('../config.js')
const FeedSchedule = require('./FeedSchedule.js')
const Supporter = require('./db/Supporter.js')
const debug = require('../util/debugFeeds.js')
const ArticleMessageQueue = require('./ArticleMessageQueue.js')
const log = require('../util/logger.js')
const Schedule = require('../structs/db/Schedule.js')

class ScheduleManager {
  constructor (bot) {
    this.bot = bot
    this.articleMessageQueue = new ArticleMessageQueue()
    this.scheduleList = []
  }

  static async initializeSchedules (customSchedules) {
    await Schedule.deleteAll()
    const defaultSchedule = new Schedule({
      name: 'default',
      refreshRateMinutes: config.feeds.refreshRateMinutes
    })
    const promises = [
      defaultSchedule.save()
    ]
    if (customSchedules) {
      for (const schedule of customSchedules) {
        const { name, refreshRateMinutes } = schedule
        if (name === 'example') {
          continue
        }
        promises.push(new Schedule({
          name,
          refreshRateMinutes
        }).save())
      }
    }
    if (Supporter.compatible) {
      if (!Supporter.refreshRateMinutes || config.feeds.refreshRateMinutes === Supporter.refreshRateMinutes) {
        throw new Error('Missing valid supporter refresh rate')
      }
      promises.push(new Schedule({
        name: 'supporter',
        refreshRateMinutes: Supporter.refreshRateMinutes
      }).save())
    }
    await Promise.all(promises)
  }

  async _queueArticle (article) {
    if (debug.feeds.has(article._delivery.rssName)) {
      log.debug.info(`${article._delivery.rssName} ScheduleManager queueing article ${article.link} to send`)
    }
    try {
      await this.articleMessageQueue.enqueue(article)
    } catch (err) {
      if (config.log.linkErrs === true) {
        const channel = this.bot.channels.get(article._delivery.source.channel)
        log.general.warning(`Failed to send article ${article.link}`, channel.guild, channel, err)
        if (err.code === 50035) {
          channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``).catch(err => log.general.warning(`Unable to send failed-to-send message for article`, err))
        }
      }
    }
  }

  _finishSchedule () {
    this.articleMessageQueue.send(this.bot)
      .catch(err => log.general.error('Failed to send a delayed articleMessage', err, err.guild, true))
  }

  async _registerSchedules () {
    const schedules = await Schedule.getAll()
    for (const schedule of schedules) {
      const feedSchedule = new FeedSchedule(this.bot, schedule, this)
      this.scheduleList.push(feedSchedule)
      feedSchedule.on('article', this._queueArticle.bind(this))
      feedSchedule.on('finish', this._finishSchedule.bind(this))
      if (this.bot.shard && this.bot.shard.count > 0) {
        process.send({ _drss: true, type: 'addCustomSchedule', schedule: schedule })
      }
    }
  }

  run (refreshRate) { // Run schedules with respect to their refresh times
    for (var feedSchedule of this.scheduleList) {
      if (feedSchedule.refreshRate === refreshRate) {
        return feedSchedule.run().catch(err => log.cycle.error(`${this.bot.shard && this.bot.shard.count > 0 ? `SH ${this.bot.shard.id} ` : ''}Schedule ${this.name} failed to run cycle`, err))
      }
    }
    // If there is no schedule with that refresh time
    if (this.bot.shard && this.bot.shard.count > 0) process.send({ _drss: true, type: 'scheduleComplete', refreshRate })
  }

  stopSchedules () {
    this.scheduleList.forEach(schedule => schedule.stop())
  }

  startSchedules () {
    this.scheduleList.forEach(schedule => schedule.start())
  }

  getSchedule (name) {
    for (const schedule of this.scheduleList) {
      if (schedule.name === name) return schedule
    }
  }

  cyclesInProgress (name) {
    for (var feedSchedule of this.scheduleList.length) {
      if (name && feedSchedule.name === name && feedSchedule.inProgress) return true
      else if (feedSchedule.inProgress) return true
    }
    return false
  }
}

module.exports = ScheduleManager

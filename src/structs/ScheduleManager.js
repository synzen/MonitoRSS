const config = require('../config.js')
const FeedSchedule = require('./FeedSchedule.js')
const ArticleMessageQueue = require('./ArticleMessageQueue.js')
const Schedule = require('../structs/db/Schedule.js')
const debug = require('../util/debugFeeds.js')
const log = require('../util/logger.js')
const ipc = require('../util/ipc.js')


class ScheduleManager {
  /**
   * @param {import('discord.js').Client} bot
   * @param {number} shardID
   */
  constructor (bot, shardID) {
    this.bot = bot
    this.shardID = shardID
    this.articleMessageQueue = new ArticleMessageQueue(bot)
    this.scheduleList = []
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
          channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``)
            .catch(err => log.general.warning(`Unable to send failed-to-send message for article`, err))
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
    }
  }

  run (refreshRate) { // Run schedules with respect to their refresh times
    for (var feedSchedule of this.scheduleList) {
      if (feedSchedule.refreshRate === refreshRate) {
        return feedSchedule.run()
          .catch(err => log.cycle.error(`SH ${this.shardID} Schedule ${this.name} failed to run cycle`, err))
      }
    }
    // If there is no schedule with that refresh time
    ipc.send(ipc.TYPES.SCHEDULE_COMPLETE, {
      refreshRate
    })
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

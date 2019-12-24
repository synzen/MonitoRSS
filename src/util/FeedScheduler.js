const config = require('../config.js')
const debug = require('../util/debugFeeds.js')
const log = require('../util/logger.js')
const dbOpsSchedules = require('../util/db/schedules.js')
const AssignedScheduleModel = require('../models/AssignedSchedule.js')
const Feed = require('../structs/db/Feed.js')

class FeedScheduler {
  static async clearAll () {
    await dbOpsSchedules.assignedSchedules.clear()
  }

  static async assignSchedules (shard, guildIds, vipServers) {
    // Remove the old schedules
    const promises = [
      dbOpsSchedules.schedules.getAll(),
      Feed.getAll()
    ]

    const results = await Promise.all(promises)

    const scheduleList = results[0]
    const guildIdsSet = new Set(guildIds)
    const schedulesByName = {}
    for (const schedule of scheduleList) {
      schedulesByName[schedule.name] = schedule
    }

    const feeds = results[1]
    const scheduleDeterminationPromises = []
    const feedRecords = []
    feeds.forEach(feed => {
      if (!guildIdsSet.has(feed.guild)) {
        return
      }

      scheduleDeterminationPromises.push(FeedScheduler.determineSchedule(feed, feed.guild, vipServers, shard, scheduleList))
      feedRecords.push({
        feedID: feed.id,
        guildID: feed.guild,
        link: feed.url
      })
    })
    const scheduleNames = await Promise.all(scheduleDeterminationPromises)
    const documentsToInsert = []
    const AssignedSchedule = AssignedScheduleModel.model()
    for (let i = 0; i < scheduleNames.length; ++i) {
      const scheduleName = scheduleNames[i]
      const { feedID, link, guildID } = feedRecords[i]
      if (debug.feeds.has(feedID)) {
        log.debug.info(`${feedID}: Determined schedule is ${scheduleName}`)
      }
      const toInsert = {
        feedID,
        schedule: scheduleName,
        link,
        guildID,
        shard
      }
      documentsToInsert.push(new AssignedSchedule(toInsert))
    }

    await dbOpsSchedules.assignedSchedules.setMany(documentsToInsert)
  }

  /**
   * @param {import('../structs/db/Feed.js')} feed
   * @param {string} guildId
   * @param {string[]} vipServers
   * @param {string} shardID
   * @param {Object<string, Object>[]} scheduleList
   */
  static async determineSchedule (feed, guildId, vipServers, shardID, scheduleList) {
    if (!scheduleList) {
      scheduleList = await dbOpsSchedules.schedules.getAll()
    }

    // const source = guildRss.sources[rssName]
    let assignedSchedule = await dbOpsSchedules.assignedSchedules.get(feed.id, shardID)

    // Take care of our VIPs
    if (config._vip === true && !feed.url.includes('feed43')) {
      const validVip = vipServers.includes(guildId)
      if (validVip && assignedSchedule !== 'vip') {
        return 'vip'
      }
    }

    if (!assignedSchedule) {
      for (const schedule of scheduleList) {
        if (schedule.name === 'default' || (config._vip === true && schedule.name === 'vip')) {
          continue
        }
        // Check if non-default schedules first
        // rssnames first
        const feedIDs = schedule.feedIDs // Potential array
        if (feedIDs && feedIDs.has(feed.id)) {
          return schedule.name
        }
        // keywords second
        const sKeywords = schedule.keywords
        if (!sKeywords) {
          continue
        }
        for (const word of sKeywords) {
          if (!feed.url.includes(word)) {
            continue
          }
          return schedule.name
        }
      }

      if (!assignedSchedule) {
        return 'default'
      }
    }
  }

  /**
   * @param {import('../structs/db/Feed.js')} feed
   * @param {string} guildId
   * @param {string} shardId
   * @param {Object<string, Object>[]} vipServers
   */
  static async reassignSchedule (feed, guildId, shardId, vipServers) {
    await feed.removeSchedule(shardId)
    await this.assignSchedule(feed, guildId, shardId, vipServers)
  }

  /**
   * @param {import('../structs/db/Feed.js')} feed
   * @param {string} guildId
   * @param {string} shardId
   * @param {Object<string, Object>[]} vipServers
   */
  static async assignSchedule (feed, guildId, shardId, vipServers) {
    const scheduleName = await FeedScheduler.determineSchedule(feed, guildId, vipServers, shardId)
    return dbOpsSchedules.assignedSchedules.set(feed.id, scheduleName, feed.url, guildId, shardId)
  }
}

module.exports = FeedScheduler

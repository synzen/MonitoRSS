const config = require('../config.js')
const debug = require('../util/debugFeeds.js')
const log = require('../util/logger.js')
const AssignedSchedule = require('../structs/db/AssignedSchedule.js')
const Feed = require('../structs/db/Feed.js')
const Schedule = require('../structs/db/Schedule.js')

class FeedScheduler {
  static async assignSchedules (shard, guildIds, vipServers) {
    // Remove the old schedules
    const promises = [
      Schedule.getAll(),
      Feed.getAll()
    ]

    const results = await Promise.all(promises)

    const scheduleList = results[0]
    const guildIdsSet = new Set(guildIds)

    const feeds = results[1]
    const scheduleDeterminationPromises = []
    const feedRecords = []
    feeds.forEach(feed => {
      if (!guildIdsSet.has(feed.guild)) {
        return
      }

      scheduleDeterminationPromises.push(FeedScheduler.determineSchedule(feed, feed.guild, vipServers, shard, scheduleList))
      feedRecords.push({
        feed: feed._id,
        guild: feed.guild,
        url: feed.url
      })
    })
    const scheduleNames = await Promise.all(scheduleDeterminationPromises)
    const documentsToInsert = []
    for (let i = 0; i < scheduleNames.length; ++i) {
      const scheduleName = scheduleNames[i]
      const { feed, url, guild } = feedRecords[i]
      if (debug.feeds.has(feed)) {
        log.debug.info(`${feed}: Determined schedule is ${scheduleName}`)
      }
      const toInsert = {
        feed,
        schedule: scheduleName,
        url,
        guild: guild,
        shard
      }
      documentsToInsert.push(new AssignedSchedule(toInsert).save())
    }
    await Promise.all(documentsToInsert)
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
      scheduleList = await Schedule.getAll()
    }

    // const source = guildRss.sources[rssName]
    let assignedSchedule = await AssignedSchedule.getByFeedAndShard(feed._id, shardID)

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
        const feedIDs = schedule.feeds // Potential array
        if (feedIDs && feedIDs.has(feed._id)) {
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
    const assigned = new AssignedSchedule({
      feed: feed._id,
      schedule: scheduleName,
      url: feed.url,
      guild: guildId,
      shard: shardId
    })
    await assigned.save()
    return assigned
  }
}

module.exports = FeedScheduler

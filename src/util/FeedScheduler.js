const debug = require('../util/debugFeeds.js')
const log = require('../util/logger.js')
const AssignedSchedule = require('../structs/db/AssignedSchedule.js')
const Feed = require('../structs/db/Feed.js')
const Schedule = require('../structs/db/Schedule.js')
const Supporter = require('../structs/db/Supporter.js')

class FeedScheduler {
  static async assignSchedules (shard, guildIds) {
    // Remove the old schedules
    const results = await Promise.all([
      Schedule.getAll(),
      Feed.getAll(),
      Supporter.getValidServers()
    ])

    const scheduleList = results[0]
    const feeds = results[1]
    const supporterServers = results[2]

    const guildIdsSet = new Set(guildIds)
    const assignments = []
    feeds.forEach(feed => {
      if (!guildIdsSet.has(feed.guild)) {
        return
      }
      const promise = this.assignSchedule(feed, feed.guild, shard, supporterServers, scheduleList)
      assignments.push(promise)
    })
    await Promise.all(assignments)
  }

  /**
   * @param {import('../structs/db/Feed.js')} feed
   * @param {string} guildId
   * @param {string[]} vipServers
   * @param {string} shardID
   * @param {Object<string, Object>[]} scheduleList
   */
  static async determineSchedule (feed, guildId, supporterServers, shardID, scheduleList) {
    if (!scheduleList) {
      scheduleList = await Schedule.getAll()
    }

    if (!supporterServers) {
      supporterServers = await Supporter.getValidServers()
    }

    // const source = guildRss.sources[rssName]
    let assignedSchedule = await AssignedSchedule.getByFeedAndShard(feed._id, shardID)

    // Take care of our VIPs
    if (Supporter.compatible && !feed.url.includes('feed43')) {
      const validVip = supporterServers.includes(guildId)
      if (validVip && assignedSchedule !== 'vip') {
        return 'vip'
      }
    }

    if (!assignedSchedule) {
      for (const schedule of scheduleList) {
        if (schedule.name === 'default' || (Supporter.compatible && schedule.name === 'vip')) {
          continue
        }
        // Check if non-default schedules first
        // rssnames first
        const feedIDs = schedule.feeds // Potential array
        if (feedIDs && feedIDs.includes(feed._id)) {
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
   * @param {Object<string, Object>[]} supporterServers
   */
  static async reassignSchedule (feed, guildId, shardId, supporterServers) {
    await feed.removeSchedule(shardId)
    await this.assignSchedule(feed, guildId, shardId, supporterServers)
  }

  /**
   * @param {import('../structs/db/Feed.js')} feed
   * @param {string} guildId
   * @param {string} shardId
   * @param {Object<string, Object>[]} [supporterServers]
   * @param {Object<string, Object>[]} [scheduleList]
   */
  static async assignSchedule (feed, guildId, shardId, supporterServers, scheduleList) {
    const scheduleName = await FeedScheduler.determineSchedule(feed, guildId, supporterServers, shardId, scheduleList)
    if (debug.feeds.has(feed._id)) {
      log.debug.info(`${feed._id}: Determined schedule is ${scheduleName}`)
    }
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

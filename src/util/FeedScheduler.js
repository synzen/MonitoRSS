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
      Supporter.getValidGuilds()
    ])

    const scheduleList = results[0]
    const feeds = results[1]
    const supporterGuilds = results[2]

    const guildIdsSet = new Set(guildIds)
    const assignments = []
    feeds.forEach(feed => {
      if (!guildIdsSet.has(feed.guild)) {
        return
      }
      const promise = this.assignSchedule(feed, feed.guild, shard, supporterGuilds, scheduleList)
      assignments.push(promise)
    })
    await Promise.all(assignments)
  }

  /**
   * @param {import('../structs/db/Feed.js')} feed
   * @param {string} guildId
   * @param {string[]} supporterGuilds
   * @param {string} shardID
   * @param {Object<string, Object>[]} scheduleList
   */
  static async determineSchedule (feed, guildId, supporterGuilds, shardID, scheduleList) {
    if (!scheduleList) {
      scheduleList = await Schedule.getAll()
    }

    if (!supporterGuilds) {
      supporterGuilds = await Supporter.getValidGuilds()
    }

    // const source = guildRss.sources[rssName]
    let assignedSchedule = await AssignedSchedule.getByFeedAndShard(feed._id, shardID)

    // Take care of our VIPs
    if (Supporter.enabled && !feed.url.includes('feed43')) {
      const validSupporter = supporterGuilds.includes(guildId)
      if (validSupporter && assignedSchedule !== Supporter.schedule.name) {
        return Supporter.schedule.name
      }
    }

    if (!assignedSchedule) {
      for (const schedule of scheduleList) {
        if (schedule.name === 'default' || (Supporter.enabled && schedule.name === Supporter.schedule.name)) {
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
   * @param {Object<string, Object>[]} supporterGuilds
   */
  static async reassignSchedule (feed, guildId, shardId, supporterGuilds) {
    await feed.removeSchedule(shardId)
    await this.assignSchedule(feed, guildId, shardId, supporterGuilds)
  }

  /**
   * @param {import('../structs/db/Feed.js')} feed
   * @param {string} guildId
   * @param {string} shardId
   * @param {Object<string, Object>[]} [supporterGuilds]
   * @param {Object<string, Object>[]} [scheduleList]
   */
  static async assignSchedule (feed, guildId, shardId, supporterGuilds, scheduleList) {
    const scheduleName = await FeedScheduler.determineSchedule(feed, guildId, supporterGuilds, shardId, scheduleList)
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

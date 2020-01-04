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
      const promise = feed.assignSchedule(shard, supporterGuilds, scheduleList)
      assignments.push(promise)
    })
    await Promise.all(assignments)
  }
}

module.exports = FeedScheduler

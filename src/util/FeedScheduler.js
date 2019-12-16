const config = require('../config.js')
const debug = require('../util/debugFeeds.js')
const log = require('../util/logger.js')
const dbOpsSchedules = require('../util/db/schedules.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const AssignedScheduleModel = require('../models/AssignedSchedule.js')
const ArticleModel = require('../models/Article.js')

class FeedScheduler {
  static async clearAll () {
    await dbOpsSchedules.assignedSchedules.clear()
  }

  static async assignSchedules (shard, guildIds, vipServers) {
    // Remove the old schedules
    const promises = [
      dbOpsSchedules.schedules.getAll(),
      dbOpsGuilds.getAll()
    ]

    // if (config._vip === true) {
    // promises.push(dbOpsVips.getAll())
    // }

    const results = await Promise.all(promises)

    const scheduleList = results[0]
    const guildIdsSet = new Set(guildIds)
    const schedulesByName = {}
    for (const schedule of scheduleList) {
      schedulesByName[schedule.name] = schedule
    }

    const guildRssList = results[1]
    // const vipServers = []
    // if (config._vip === true) {
    //   const vipUsers = results[3]
    //   for (const vipUser of vipUsers) {
    //     if (vipUser.invalid || vipUser.regularRefreshRate) {
    //       continue
    //     }
    //     for (const serverId of vipUser.servers) {
    //       vipServers.push(serverId)
    //     }
    //   }
    // }
    const scheduleDeterminationPromises = []
    const feedRecords = []
    guildRssList.forEach(guildRss => {
      if (!guildIdsSet.has(guildRss.id)) {
        return
      }
      const rssList = guildRss.sources
      for (const rssName in rssList) {
        scheduleDeterminationPromises.push(FeedScheduler.determineSchedule(rssName, guildRss, vipServers, shard, scheduleList))
        feedRecords.push({ feedID: rssName, guildID: guildRss.id, link: rssList[rssName].link })
      }
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
      const toInsert = { feedID, schedule: scheduleName, link, guildID, shard }
      documentsToInsert.push(new AssignedSchedule(toInsert))
    }

    await dbOpsSchedules.assignedSchedules.setMany(documentsToInsert)
  }

  static async determineSchedule (rssName, guildRss, vipServers, shardID, scheduleList) {
    // if (config._vip === true && !vipServers) {
    //   vipServers = []
    //   const vipUsers = await dbOpsVips.getAll()
    //   for (const vipUser of vipUsers) {
    //     if (vipUser.invalid) {
    //       continue
    //     }
    //     for (const serverId of vipUser.servers) {
    //       vipServers.push(serverId)
    //     }
    //   }
    // }

    if (!scheduleList) {
      scheduleList = await dbOpsSchedules.schedules.getAll()
    }

    const source = guildRss.sources[rssName]
    let assignedSchedule = await dbOpsSchedules.assignedSchedules.get(rssName, shardID)

    // Take care of our VIPs
    if (config._vip === true && !source.link.includes('feed43')) {
      const validVip = vipServers.includes(guildRss.id)
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
        if (feedIDs && feedIDs.has(rssName)) {
          return schedule.name
        }
        // keywords second
        const sKeywords = schedule.keywords
        if (!sKeywords) {
          continue
        }
        for (const word of sKeywords) {
          if (!source.link.includes(word)) {
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

  static async reassignSchedule (feedID, guildRss, shardId, vipServers) {
    await FeedScheduler.removeScheduleOfFeed(feedID, guildRss.sources[feedID].link)
    await this.assignSchedule(feedID, guildRss, shardId, vipServers)
  }

  static async assignSchedule (feedID, guildRss, shardId, vipServers) {
    const scheduleName = await FeedScheduler.determineSchedule(feedID, guildRss, vipServers, shardId)
    return dbOpsSchedules.assignedSchedules.set(feedID, scheduleName, guildRss.sources[feedID].link, guildRss.id, shardId)
  }

  static async removeScheduleOfFeed (feedID, link, shardID) {
    const assigned = await dbOpsSchedules.assignedSchedules.get(feedID)
    if (!assigned) return
    // const shardID = this.bot.shard ? this.bot.shard.id : 0
    await dbOpsSchedules.assignedSchedules.remove(feedID)
    const assignedSchedules = await dbOpsSchedules.assignedSchedules.getMany(shardID, assigned.schedule, link)
    if (assignedSchedules.length === 0 && config.database.uri.startsWith('mongo')) {
      ArticleModel.model(link, shardID, assigned.schedule).collection.drop().catch(err => err.code === 26 ? null : log.general.error('Failed to drop unused collection after feed removal', err))
    }
  }
}

module.exports = FeedScheduler

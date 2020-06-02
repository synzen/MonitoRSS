const Discord = require('discord.js')
const moment = require('moment')
const GeneralStats = require('../models/GeneralStats.js')
const ScheduleStats = require('../structs/db/ScheduleStats.js')

module.exports = async (message) => {
  const [allScheduleStats, allGeneralStats] = await Promise.all([
    ScheduleStats.getAll(),
    GeneralStats.Model.find().lean().exec()
  ])
  const bot = message.client
  const scheduleStats = allScheduleStats.find(r => r._id === 'default')
  if (!scheduleStats) {
    return message.channel.send('More time is needed to gather enough information. Try again later.')
  }
  if (scheduleStats.feeds === 0) {
    return message.channel.send('No feeds found for any data.')
  }
  const sizeFetches = await bot.shard.fetchClientValues('guilds.cache.size')

  const aggregated = {
    guilds: sizeFetches.reduce((prev, val) => prev + val, 0),
    feeds: scheduleStats.feeds,
    cycleTime: scheduleStats.cycleTime,
    cycleFails: scheduleStats.cycleFails,
    cycleURLs: scheduleStats.cycleURLs,
    lastUpdated: new Date(scheduleStats.lastUpdated),
    articlesSent: allGeneralStats.find(doc => doc._id === GeneralStats.TYPES.ARTICLES_SENT),
    articlesBlocked: allGeneralStats.find(doc => doc._id === GeneralStats.TYPES.ARTICLES_BLOCKED)
  }

  const visual = new Discord.MessageEmbed()
    .setAuthor('Basic Stats')
    .setDescription(`
**Unique Feeds** - Number of unique feed links (duplicate links are not counted).
**Total Feeds** - Number of total feeds.
**Cycle Duration** - Time taken to process all the unique feeds.
**Cycle Failures** - Number of failures out of the number of unique feeds per cycle. 
**Success Rate** - Rate at which unique links connect successfully per cycle. A high rate is necessary to ensure that all feeds are fetched.
**Articles Sent** - Total number of articles sent
**Articles Blocked** - Total number of articles blocked by article rate limits\n\u200b`)

  const guilds = `${aggregated.guilds}`
  const feeds = `${aggregated.feeds}`
  const cycleURLs = `${aggregated.cycleURLs}`
  const cycleFails = `${aggregated.cycleFails}`
  const cycleTime = `${aggregated.cycleTime.toFixed(2)}s`
  const successRate = `${((1 - aggregated.cycleFails / aggregated.cycleURLs) * 100).toFixed(2)}%`
  const articlesSent = aggregated.articlesSent ? aggregated.articlesSent.data : 0
  const articlesBlocked = aggregated.articlesBlocked ? aggregated.articlesBlocked.data : 0

  visual
    .addField('Servers', guilds, true)
    .addField('Shard Count', bot.shard.count, true)
    .addField('\u200b', '\u200b', true)

  let diff = moment.duration(moment().diff(moment(aggregated.lastUpdated)))
  if (diff.asMinutes() < 1) {
    diff = `Updated ${diff.asSeconds().toFixed(2)} seconds ago`
  } else {
    diff = `Updated ${diff.asMinutes().toFixed(2)} minutes ago`
  }

  visual
    .addField('Unique Feeds', cycleURLs, true)
    .addField('Total Feeds', feeds, true)
    .addField('Cycle Duration', cycleTime, true)
    .addField('Cycle Failures', cycleFails, true)
    .addField('Success Rate', successRate, true)
    .addField('\u200b', '\u200b', true)
    .addField('Articles Sent', articlesSent, true)
    .addField('Articles Blocked', articlesBlocked, true)
    .addField('\u200b', '\u200b', true)
    .setFooter(diff)

  await message.channel.send('', visual)
}

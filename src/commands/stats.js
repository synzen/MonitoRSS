const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const moment = require('moment')
const ShardStats = require('../structs/db/ShardStats.js')

module.exports = async (bot, message) => {
  try {
    const results = await ShardStats.getAll()
    if (bot.shard.count > results.length) {
      return await message.channel.send('More time is needed to gather enough information. Try again later.')
    }
    const sizeFetches = await bot.shard.fetchClientValues('guilds.size')

    let shardCount = results.length
    const aggregated = {
      guilds: sizeFetches.reduce((prev, val) => prev + val, 0),
      feeds: 0,
      cycleTime: 0,
      cycleFails: 0,
      cycleURLs: 0
    }

    for (const shardStats of results) {
      if (shardStats.feeds === 0) {
        continue
      }
      aggregated.feeds += shardStats.feeds
      aggregated.cycleTime += shardStats.cycleTime
      aggregated.cycleFails += shardStats.cycleFails
      aggregated.cycleURLs += shardStats.cycleURLs

      const lastUpdated = new Date(shardStats.lastUpdated)
      aggregated.lastUpdated = !aggregated.lastUpdated ? lastUpdated : lastUpdated > aggregated.lastUpdated ? lastUpdated : aggregated.lastUpdated
    }

    const averaged = {
      guilds: (aggregated.guilds / shardCount).toFixed(2),
      feeds: (aggregated.feeds / shardCount).toFixed(2),
      cycleTime: (aggregated.cycleTime / shardCount).toFixed(2),
      cycleFails: (aggregated.cycleFails / shardCount).toFixed(2),
      cycleURLs: (aggregated.cycleURLs / shardCount).toFixed(2)
    }

    const visual = new MenuUtils.Menu(message, null, { numbered: false, maxPerPage: 9 })
      .setAuthor('Basic Performance Stats')
      .setDescription(`${bot.shard && bot.shard.count > 0 ? 'Note that Per Shard values are averaged\n' : ''} 
  **Unique Feeds** - Number of unique feed links (duplicate links are not counted).
  **Total Feeds** - Number of total feeds.
  **Cycle Duration** - The time it takes to process all the unique feed links.
  **Cycle Failures** - The number of failures out of the number of unique feeds per cycle. 
  **Success Rate** - The rate at which unique links connect successfully per cycle. A high rate is necessary to ensure that all feeds are fetched.\n\u200b`)

    const guilds = `Per Shard: ${averaged.guilds}\nGlobal: ${aggregated.guilds}`
    const feeds = `Per Shard: ${averaged.feeds}\nGlobal: ${aggregated.feeds}`
    const cycleURLs = averaged.cycleTime ? `Per Shard: ${averaged.cycleURLs}\nGlobal: ${aggregated.cycleURLs.toFixed(2)}` : 'No data available yet.'
    const cycleFails = averaged.cycleTime ? `Per Shard: ${averaged.cycleFails}\nGlobal: ${aggregated.cycleFails.toFixed(2)}` : 'No data available yet.'
    const cycleTime = averaged.cycleTime ? `Per Shard: ${averaged.cycleTime}s\nGlobal: ${aggregated.cycleTime.toFixed(2)}s` : 'No data available yet.'
    const successRate = averaged.cycleTime ? `Per Shard: ${((1 - averaged.cycleFails / averaged.cycleURLs) * 100).toFixed(2)}%\nGlobal: ${((1 - aggregated.cycleFails / aggregated.cycleURLs) * 100).toFixed(2)}%` : 'No data available yet.'

    visual.addOption('Servers', guilds, true)
    visual.addOption('Shard Count', bot.shard.count, true).addOption(null, null, true)
    let diff = moment.duration(moment().diff(moment(aggregated.lastUpdated)))
    if (diff.asMinutes() < 1) {
      diff = `Updated ${diff.asSeconds().toFixed(2)} seconds ago`
    } else {
      diff = `Updated ${diff.asMinutes().toFixed(2)} minutes ago`
    }

    visual
      .addOption('Unique Feeds', cycleURLs, true)
      .addOption('Total Feeds', feeds, true)
      .addOption('Cycle Duration', cycleTime, true)
      .addOption('Cycle Failures', cycleFails, true)
      .addOption('Success Rate', successRate, true)
      .setFooter(diff)

    visual.addOption(null, null, true)

    await visual.send()
  } catch (err) {
    log.command.warning(`rssstats`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssstats 1', message.guild, err))
  }
}

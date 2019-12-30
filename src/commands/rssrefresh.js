const log = require('../util/logger.js')
const channelTracker = require('../util/channelTracker.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const FailCounter = require('../structs/db/FailCounter.js')
const Feed = require('../structs/db/Feed.js')

module.exports = async (bot, message, command) => {
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
    if (feeds.length === 0) {
      return await message.channel.send(translate('commands.rsslist.noFeeds'))
    }

    if (FailCounter.limit === 0) {
      return await message.channel.send(translate('commands.rssrefresh.noFailLimit'))
    }

    let counters = []
    channelTracker.add(message.channel.id)
    for (const feed of feeds) {
      const failCounter = await FailCounter.getBy('url', feed.url)
      if (!failCounter || !failCounter.hasFailed()) {
        continue
      }
      counters.push(failCounter)
    }
    if (counters.length === 0) {
      channelTracker.remove(message.channel.id)
      return await message.channel.send(translate('commands.rssrefresh.noFailedFeeds'))
    }
    const processing = await message.channel.send(translate('commands.rssrefresh.processing'))
    let failedReasons = {}
    for (const counter of counters) {
      const url = counter.url
      log.command.info(`Attempting to refresh ${url}`, message.guild)
      try {
        await FeedFetcher.fetchURL(url)
        await counter.delete()
        log.command.info(`Refreshed ${url} and is back on cycle`, message.guild)
      } catch (err) {
        failedReasons[url] = err.message
      }
    }

    let successfulLinks = ''
    let failedLinks = ''
    for (const counter of counters) {
      const url = counter.url
      if (!failedReasons[url]) {
        successfulLinks += `${url}\n`
      } else {
        failedLinks += `${url} (${failedReasons[url]})`
      }
    }

    let reply = ''
    if (successfulLinks) {
      reply += translate('commands.rssrefresh.success') + '\n```' + successfulLinks + '```\n\n'
    }
    if (failedLinks) {
      reply += translate('commands.rssrefresh.failed') + '\n```' + failedLinks + '```'
    }
    channelTracker.remove(message.channel.id)
    await processing.edit(reply)
  } catch (err) {
    log.command.warning(`rssrefresh`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssrefresh 1', message.guild, err))
  }
}

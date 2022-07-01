const FeedFetcher = require('../util/FeedFetcher.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const FailRecord = require('../structs/db/FailRecord.js')
const Feed = require('../structs/db/Feed.js')
const createLogger = require('../util/logger/create.js')

module.exports = async (message) => {
  const profile = await Profile.get(message.guild.id)
  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const translate = Translator.createLocaleTranslator(profile ? profile.locale : undefined)
  if (feeds.length === 0) {
    return message.channel.send(translate('commands.list.noFeeds'))
  }

  if (FailRecord.limit === 0) {
    return message.channel.send(translate('commands.refresh.noFailLimit'))
  }

  const records = []
  for (const feed of feeds) {
    const failRecord = await FailRecord.get(feed.url)
    if (!failRecord || !failRecord.hasFailed()) {
      continue
    }
    records.push(failRecord)
  }
  if (records.length === 0) {
    return message.channel.send(translate('commands.refresh.noFailedFeeds'))
  }
  const log = createLogger(message.guild.shard.id)
  const processing = await message.channel.send(translate('commands.refresh.processing'))

  let successfulLinks = ''
  let failedLinks = ''

  for (const record of records) {
    const url = record._id
    log.info({
      guild: message.guild
    }, `Attempting to refresh ${url}`)
    try {
      await FeedFetcher.fetchURL(url)
      await record.delete()
      successfulLinks += `${url}\n`
      log.info({
        guild: message.guild
      }, `Refreshed ${url} and is back on cycle`)
    } catch (err) {
      failedLinks += `${url} (${err.message})`
      log.info({
        guild: message.guild,
        error: err
      }, `Failed to refresh ${url} (${err.message})`)
    }
  }

  let reply = ''
  if (successfulLinks) {
    reply += translate('commands.refresh.success') + '\n```' + successfulLinks + '```\n\n'
  }
  if (failedLinks) {
    reply += translate('commands.refresh.failed') + '\n```' + failedLinks + '```'
  }
  await processing.edit(reply)
}

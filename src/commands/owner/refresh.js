const FeedFetcher = require('../../util/FeedFetcher.js')
const FailRecord = require('../../structs/db/FailRecord.js')
const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]

  if (FailRecord.limit === 0) {
    return message.channel.send('No fail limit has been set.')
  }
  const record = await FailRecord.get(link)
  if (!record || !record.hasFailed()) {
    return message.channel.send('That is not a failed link.')
  }

  await FeedFetcher.fetchURL(link)
  await record.delete()
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Link ${link} has been refreshed and will be back on cycle.`)
  await message.channel.send(`Successfully refreshed <${link}>.`)
}

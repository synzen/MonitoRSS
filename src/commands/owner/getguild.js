const Profile = require('../../structs/db/Profile.js')
const Feed = require('../../structs/db/Feed.js')
const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const guildId = content[1]
  const profile = await Profile.get(guildId)
  const log = createLogger(message.guild.shard.id)
  const feeds = await Feed.getManyBy('guild', guildId)
  log.owner({
    profile: profile ? profile.toJSON() : null,
    feeds: feeds.map(feed => feed.toJSON())
  }, `Profile and Feeds output of ${guildId}`)
  await message.channel.send('Check logs')
}

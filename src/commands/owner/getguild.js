const log = require('../../util/logger.js')
const GuildProfile = require('../../structs/db/GuildProfile.js')
const Feed = require('../../structs/db/Feed.js')

module.exports = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const guildId = content[1]
  try {
    const profile = await GuildProfile.get(guildId)
    console.log('Profile ', profile)
    const feeds = await Feed.getManyBy('guild', guildId)
    console.log('Feeds ', feeds)
    await message.channel.send('Check console log')
  } catch (err) {
    log.owner.warning('getguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('getguild 1a', message.guild, err))
  }
}

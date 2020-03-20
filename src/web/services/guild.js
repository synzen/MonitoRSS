const RedisGuild = require('../../structs/db/Redis/Guild.js')
const RedisChannel = require('../../structs/db/Redis/Channel.js')
const GuildData = require('../../structs/GuildData.js')
const Profile = require('../../structs/db/Profile.js')

async function getAppData (guildID) {
  const data = await GuildData.get(guildID)
  if (data) {
    return data.toJSON()
  } else {
    return null
  }
}

async function getCachedGuild (guildID) {
  const guild = await RedisGuild.fetch(guildID)
  if (guild) {
    return guild.toJSON()
  } else {
    return null
  }
}

async function getFeedLimit (guildID) {
  return Profile.getFeedLimit(guildID)
}

async function getGuild (guildID) {
  const [
    cached,
    profile,
    limit
  ] = await Promise.all([
    getCachedGuild(guildID),
    Profile.get(guildID),
    getFeedLimit(guildID)
  ])
  return {
    ...cached,
    profile,
    limit
  }
}

async function updateProfile (guildID, guildName, data) {
  const profile = await Profile.get(guildID)
  if (profile) {
    for (const key in data) {
      profile[key] = data[key]
    }
    await profile.save()
    return profile.toJSON()
  }
  const newProfile = new Profile({
    ...data,
    _id: guildID,
    name: guildName
  })
  await newProfile.save()
  return newProfile.toJSON()
}

/**
 * @param {string} guildID
 * @param {string} channelID
 */
async function guildHasChannel (guildID, channelID) {
  const channel = await RedisChannel.fetch(channelID)
  if (!channel) {
    return false
  }
  return channel.guildID === guildID
}

module.exports = {
  getAppData,
  getCachedGuild,
  updateProfile,
  getFeedLimit,
  guildHasChannel,
  getGuild
}

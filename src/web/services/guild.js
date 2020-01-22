const fetch = require('node-fetch')
const RedisGuild = require('../../structs/db/Redis/Guild.js')
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

async function getGuild (guildID) {
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

async function getProfile (guildID) {
  return Profile.get(guildID)
}

async function fetchMember (guildID) {

}

module.exports = {
  getAppData,
  getGuild,
  getProfile,
  getFeedLimit
}

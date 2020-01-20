const fetch = require('node-fetch')
const RedisGuild = require('../../structs/db/Redis/Guild.js')
const GuildData = require('../../structs/GuildData.js')
const Profile = require('../../structs/db/Profile.js')

async function getAppData (guildID) {
  return GuildData.get(guildID).toJSON()
}

async function getGuild (guildID) {
  const guild = await RedisGuild.fetch(guildID)
  return guild.toJSON()
}

async function getFeedLimit (guildID) {
  return Profile.getFeedLimit(guildID)
}

async function fetchMember (guildID) {

}

module.exports = {
  getAppData,
  getGuild,
  getFeedLimit
}

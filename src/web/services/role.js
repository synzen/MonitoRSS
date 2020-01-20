const RedisRole = require('../../structs/db/Redis/Role.js')

async function getRole (roleID) {
  const role = await RedisRole.fetch(roleID)
  return role.toJSON()
}

async function formatRole (roleData) {
  return {
    ...roleData,
    hexColor: roleData.hexColor === '#000000' ? '' : roleData.hexColor
  }
}

/**
 * @param {string[]} roleIDs
 */
async function getRoles (roleIDs) {
  const promises = []
  for (const id of roleIDs) {
    promises.push(getRole(id))
  }
  const resolved = await Promise.all(promises)
  return resolved.map(formatRole)
    .sort((a, b) => b.position - a.position)
}

async function isManagerOfGuild (roleID, guildID) {
  return RedisRole.utils.isManagerOfGuild(roleID, guildID)
}

module.exports = {
  getRole,
  getRoles,
  formatRole,
  isManagerOfGuild
}

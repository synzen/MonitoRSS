const RedisRole = require('../../structs/db/Redis/Role.js')

/**
 * @param {string} roleID
 */
async function getRole (roleID) {
  const role = await RedisRole.fetch(roleID)
  return role ? role.toJSON() : null
}

/**
 * @param {Object<string, any>} roleData 
 */
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

/**
 * @param {string} roleID 
 * @param {string} guildID 
 */
async function isManagerOfGuild (roleID, guildID) {
  return RedisRole.utils.isManagerOfGuild(roleID, guildID)
}

/**
 * @param {string} roleID 
 * @param {string} guildID 
 */
async function isRoleOfGuild (roleID, guildID) {
  const role = await getRole(roleID)
  if (!role) {
    return false
  }
  return role.guildID === guildID
}

module.exports = {
  getRole,
  getRoles,
  formatRole,
  isManagerOfGuild,
  isRoleOfGuild
}

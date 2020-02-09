const RedisRole = require('../../structs/db/Redis/Role.js')

/**
 * @param {string} roleID
 */
async function getRole (roleID) {
  const role = await RedisRole.fetch(roleID)
  return role ? formatRole(role.toJSON()) : null
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
  const resolved = await Promise.all(roleIDs.map(id => getRole(id)))
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

/**
 * @param {string} guildID
 */
async function getRolesOfGuild (guildID) {
  const roleIDs = await RedisRole.utils.getRolesOfGuild(guildID)
  const roles = await Promise.all(roleIDs.map(roleID => getRole(roleID)))
  return roles.filter(r => r)
}

module.exports = {
  getRole,
  getRoles,
  formatRole,
  isManagerOfGuild,
  isRoleOfGuild,
  getRolesOfGuild
}

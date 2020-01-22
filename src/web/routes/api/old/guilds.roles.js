const express = require('express')
const roles = express.Router({ mergeParams: true })
const RedisRole = require('../../../structs/db/Redis/Role.js')

async function getRoles (req, res, next) {
  const guildId = req.params.guildId
  try {
    const roles = await RedisRole.utils.getRolesOfGuild(guildId)
    const resolvedRoles = await Promise.all(roles.map(roleId => RedisRole.fetch(roleId)))
    res.json(
      resolvedRoles
        .map(role => {
          const json = role.toJSON()
          return { ...json, hexColor: role.hexColor === '#000000' ? '' : role.hexColor }
        })
        .sort((a, b) => b.position - a.position)
    )
  } catch (err) {
    next(err)
  }
}

roles.get('/', getRoles)

module.exports = {
  routes: {
    getRoles
  },
  router: roles
}

const express = require('express')
const roles = express.Router({ mergeParams: true })
const redisOps = require('../../../util/redisOps.js')

async function getRoles (req, res, next) {
  const guildId = req.params.guildId
  try {
    const roles = await redisOps.roles.getRolesOfGuild(guildId)
    const resolvedRoles = await Promise.all(roles.map(roleId => redisOps.roles.get(roleId)))
    res.json(
      resolvedRoles
        .map(role => ({ ...role, position: +role.position, hexColor: role.hexColor === '#000000' ? '' : role.hexColor }))
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

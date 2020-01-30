const roleServices = require('../../../../services/role.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getRoles (req, res, next) {
  const guildID = req.params.guildID
  try {
    const roles = await roleServices.getRolesOfGuild(guildID)
    res.json(roles)
  } catch (err) {
    next(err)
  }
}

module.exports = getRoles

const userServices = require('../../../services/user.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getMeGuilds (req, res, next) {
  const { identity, token } = req.session
  try {
    const guildsData = await userServices
      .getGuildsWithPermission(identity.id, token.access_token)
    res.json(guildsData)
  } catch (err) {
    next(err)
  }
}

module.exports = getMeGuilds

const userServices = require('../../../services/user.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getMe (req, res, next) {
  const { identity, token } = req.session
  try {
    const userCached = await userServices.getUser(identity.id)
    if (userCached) {
      return res.json(userCached)
    }
    const data = await userServices.getUserByAPI(identity.id, token.access_token)
    // req.session.identity = data
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = getMe

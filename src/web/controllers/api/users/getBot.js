const config = require('../../../../config.js')
const userServices = require('../../../services/user.js')
const createError = require('../../../util/createError.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getBot (req, res, next) {
  try {
    const userCached = await userServices.getUser(config.web.clientId)
    if (userCached) {
      return res.json(userCached)
    }
    const error = createError(404, 'Bot not found')
    res.status(404).json(error)
  } catch (err) {
    next(err)
  }
}

module.exports = getBot

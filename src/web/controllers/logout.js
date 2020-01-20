const authServices = require('../services/auth.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function logout (req, res, next) {
  const oauthClient = req.app.get('oauth2')
  const session = req.session
  try {
    await authServices.logout(oauthClient, session)
  } catch (err) {
    next(err)
  }
}

module.exports = logout

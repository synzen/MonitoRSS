
const authServices = require('../services/auth.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function login (req, res, next) {
  const oauthClient = req.app.get('oauth2')
  try {
    const url = await authServices.getAuthorizationURL(oauthClient)
    res.redirect(url)
  } catch (err) {
    next(err)
  }
}

module.exports = login

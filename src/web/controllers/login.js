const authServices = require('../services/auth.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function login (req, res, next) {
  const oauthClient = req.app.get('oauth2')
  const url = authServices.getAuthorizationURL(oauthClient)
  res.redirect(url)
}

module.exports = login

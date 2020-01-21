const authServices = require('../../services/auth.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function getAuthenticated (req, res) {
  res.json({
    authenticated: authServices.isAuthenticated(req.session)
  })
}

module.exports = getAuthenticated

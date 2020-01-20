/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function getAuthenticated (req, res) {
  res.json({
    authenticated: !!(req.session.identity && req.session.token)
  })
}

module.exports = getAuthenticated

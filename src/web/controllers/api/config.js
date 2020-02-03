const config = require('../../../config.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function getConfig (req, res) {
  res.json(config.feeds)
}

module.exports = getConfig

const configGetter = require('../../../config.js').get

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function getConfig (req, res) {
  const config = configGetter()
  res.json(config.feeds)
}

module.exports = getConfig

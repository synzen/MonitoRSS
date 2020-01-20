const htmlConstants = require('../constants/html.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function all (req, res) {
  const html = htmlConstants.indexFile
    .replace('__OG_TITLE__', htmlConstants.metaTitle)
    .replace('__OG_DESCRIPTION__', htmlConstants.metaDescription)
  return res
    .type('text/html')
    .send(html)
}

module.exports = all

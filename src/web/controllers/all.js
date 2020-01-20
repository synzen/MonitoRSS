const htmlConstants = require('../constants/html.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function all (req, res) {
  const html = htmlFile
    .replace('__OG_TITLE__', DEFAULT_META_TITLE)
    .replace('__OG_DESCRIPTION__', DEFAULT_META_DESCRIPTION)
  return res
    .type('text/html')
    .send(html)
}

module.exports = all

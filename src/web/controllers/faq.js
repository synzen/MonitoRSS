const htmlConstants = require('../constants/html.js')
const fs = require('fs')
const path = require('path')
const faq = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', `src`, 'js', 'constants', 'faq.json')))

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function controller (req, res, next) {
  const question = decodeURI(req.path.replace('/faq/', '')).replace(/-/g, ' ')
  const item = faq.find(item => item.q.replace(/\?/, '') === question)
  if (!item) {
    return next()
  }
  const html = htmlConstants.indexFile
    .replace('__OG_TITLE__', item.q)
    .replace('__OG_DESCRIPTION__', item.a)
  return res
    .type('text/html')
    .send(html)
}

module.exports = controller

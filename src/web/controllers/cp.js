const fs = require('fs')
const path = require('path')
const requestIp = require('request-ip')
const routingServices = require('../services/routing.js')
const htmlFile = fs.readFileSync(path.join(__dirname, 'client/build', 'index.html')).toString()

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function cp (req, res) {
  if (!req.session.identity || !req.session.token) {
    // Save the path to redirect them later after they're authorized
    const ip = requestIp.getClientIp(req)
    if (ip) {
      routingServices.setPath(ip, req.path)
    }
  }

  const html = htmlFile
    .replace('__OG_TITLE__', 'Control Panel')
    .replace('__OG_DESCRIPTION__', `Customizing your feeds in multiple servers has never been easier!.\n\nThis site is under construction.`)
  return res
    .type('text/html')
    .send(html)
}

module.exports = cp

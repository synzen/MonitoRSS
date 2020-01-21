const requestIp = require('request-ip')
const authServices = require('../services/auth.js')
const routingServices = require('../services/routing.js')
const htmlConstants = require('../constants/html.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function cp (req, res) {
  if (!authServices.isAuthenticated(req.session)) {
    // Save the path to redirect them later after they're authorized
    const ip = requestIp.getClientIp(req)
    if (ip) {
      routingServices.setPath(ip, req.path)
    }
  }

  const html = htmlConstants.indexFile
    .replace('__OG_TITLE__', 'Control Panel')
    .replace('__OG_DESCRIPTION__', `Customizing your feeds in multiple servers has never been easier!.\n\nThis site is under construction.`)
  return res
    .type('text/html')
    .send(html)
}

module.exports = cp

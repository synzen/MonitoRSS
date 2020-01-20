const fs = require('fs')
const config = require('../config.js')
process.env.NODE_ENV = 'production'
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const expressApp = require('./app.js')

module.exports = () => {
  // Check variables
  const { clientId, clientSecret, port: httpPort } = config.web
  if (!clientId || !clientSecret || !httpPort) {
    throw new Error(`Missing required info for web (Client ID Exists: ${!!clientId}, Client Secret Exists: ${!!clientSecret}, Web Port Exists: ${!!httpPort})`)
  }
  if (!storage.redisClient) {
    throw new Error('Redis is not connected for Web UI')
  }

  const app = expressApp()

  // Create HTTP Server
  const http = require('http').Server(app)
  http.listen(httpPort, () => {
    log.web.success(`HTTP UI listening on port ${httpPort}!`)
  })

  // Create HTTPS Server
  if (config.web.https.enabled === true) {
    const {
      privateKey,
      certificate,
      chain,
      port: httpsPort
    } = config.web.https
    if (!privateKey || !certificate || !chain) {
      throw new Error('Missing private key, certificate, or chain file path for enabled https')
    }
    const key = fs.readFileSync(privateKey, 'utf8')
    const cert = fs.readFileSync(certificate, 'utf8')
    const ca = fs.readFileSync(chain, 'utf8')
    const https = require('https').Server({
      key,
      cert,
      ca
    }, app)
    https.listen(httpsPort, () => {
      log.web.success(`HTTPS UI listening on port ${httpsPort}!`)
    })
  }
}

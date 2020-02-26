const config = require('../config.js')
const TEST_ENV = process.env.NODE_ENV === 'test'
if (!TEST_ENV) process.env.NODE_ENV = 'production'
const morgan = require('morgan')
const express = require('express')
const session = require('express-session')
const compression = require('compression')
const RedisStore = require('connect-redis')(session)
const discordAPIConstants = require('./constants/discordAPI.js')
const routes = require('./routes/index.js')
const storage = require('../util/storage.js')
const requestIp = require('request-ip')

const app = express()
const credentials = {
  client: {
    id: config.web.clientId,
    secret: config.web.clientSecret
  },
  auth: discordAPIConstants.auth
}
const oauth2 = require('simple-oauth2').create(credentials)

module.exports = () => {
  if (config.web.trustProxy) {
    app.enable('trust proxy')
  }

  // Redirect from HTTP to HTTPS if HTTPS enabled
  if (config.web.https.enabled) {
    app.use(function (req, res, next) {
      if (!req.secure) {
        res.redirect('https://' + req.headers.host + req.url)
      } else {
        next()
      }
    })
  }

  app.use(compression())
  app.use(express.json())

  // Sessions
  const session = require('express-session')({
    secret: config.web.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set secure to true for HTTPS - otherwise sessions will not be saved
    maxAge: 1 * 24 * 60 * 60, // 1 day
    store: new RedisStore({
      client: storage.redisClient // Recycle connection
    })
  })
  app.use(session)

  if (!TEST_ENV) {
    // Logging
    app.use(morgan(function (tokens, req, res) {
      const custom = []
      if (req.session && req.session.identity) {
        custom.push(`(U: ${req.session.identity.id}, ${req.session.identity.username})`)
      }
      if (req.guildRss) {
        custom.push(`(G: ${req.guildRss.id}, ${req.guildRss.name})`)
      }
      const arr = [
        tokens.date(req, res, 'clf'),
        requestIp.getClientIp(req),
        ...custom,
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'), '-',
        tokens['response-time'](req, res), 'ms'
      ]
      return arr.join(' ')
    }))
  }

  // Application-specific variables
  app.set('oauth2', oauth2)

  // Routes
  app.use(routes)

  return app
}

const path = require('path')
const fs = require('fs')
const config = require('../config.js')
const TEST_ENV = process.env.NODE_ENV === 'test'
if (!TEST_ENV) process.env.NODE_ENV = 'production'
const morgan = require('morgan')
const express = require('express')
const session = require('express-session')
const compression = require('compression')
const RedisStore = require('connect-redis')(session)
const discordAPIConstants = require('./constants/discordAPI.js')
const apiRoutes = require('./routes/api/index.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const fetchUser = require('./util/fetchUser.js')
const requestIp = require('request-ip')
const AuthPathAttempts = require('./util/AuthPathAttempts.js')

const app = express()
const attemptedPaths = new AuthPathAttempts()
const DEFAULT_META_TITLE = 'Under Construction'
const DEFAULT_META_DESCRIPTION = `Get news and notifications delivered from anywhere that supports RSS, whether it's Reddit, Youtube, or your favorite traditional news outlet.\n\nThis site is currently under construction.`
const SCOPES = 'identify guilds'
const htmlFile = fs.readFileSync(path.join(__dirname, 'client/build', 'index.html')).toString()
const faq = JSON.parse(fs.readFileSync(path.join(__dirname, 'client', `src`, 'js', 'constants', 'faq.json')))

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
      if (req.session && req.session.identity) custom.push(`(U: ${req.session.identity.id}, ${req.session.identity.username})`)
      if (req.guildRss) custom.push(`(G: ${req.guildRss.id}, ${req.guildRss.name})`)
      const arr = [
        log.formatConsoleDate(new Date()).slice(0, -1), // Remove extra white space at the end
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
  app.use('/api', apiRoutes.router)

  app.get('/login', (req, res) => {
    const authorizationUri = oauth2.authorizationCode.authorizeURL({
      redirect_uri: config.web.redirectUri,
      scope: SCOPES
    })
    res.redirect(authorizationUri)
  })

  app.get('/logout', async (req, res, next) => {
    try {
      await oauth2.accessToken.create(req.session.auth).revokeAll()
      req.session.destroy(err => err ? next(err) : res.redirect('/'))
    } catch (err) {
      next(err)
    }
  })

  app.get('/authorize', async (req, res) => {
    try {
      const result = await oauth2.authorizationCode.getToken({
        code: req.query.code,
        redirect_uri: config.web.redirectUri,
        scope: SCOPES
      })
      const accessTokenObject = oauth2.accessToken.create(result) // class with properties access_token, token_type = 'Bearer', expires_in, refresh_token, scope, expires_at
      req.session.auth = accessTokenObject.token
      req.session.identity = await fetchUser.info(req.session.identity ? req.session.identity.id : null, req.session.auth.access_token)
      log.web.info(`(${req.session.identity.id}, ${req.session.identity.username}) Logged in`)
      const ip = requestIp.getClientIp(req)
      res.redirect(attemptedPaths.get(ip) || '/cp')
    } catch (err) {
      log.web.error(`Failed to authorize Discord`, err)
      res.redirect('/')
    }
  })

  // Cache control panel requests
  app.get(['/cp', '/cp/*'], (req, res, next) => {
    if (!req.session.identity || !req.session.auth) {
      // Save the path to redirect them later after they're authorized
      const ip = requestIp.getClientIp(req)
      if (ip) {
        attemptedPaths.add(ip, req.path)
      }
    }

    const html = htmlFile
      .replace('__OG_TITLE__', 'Control Panel')
      .replace('__OG_DESCRIPTION__', `Customizing your feeds in multiple servers has never been easier!.\n\nThis site is under construction.`)
    return res
      .type('text/html')
      .send(html)
  })

  // Override the response from express.static by injecting meta title and description
  app.get('/', (req, res) => {
    const html = htmlFile
      .replace('__OG_TITLE__', DEFAULT_META_TITLE)
      .replace('__OG_DESCRIPTION__', DEFAULT_META_DESCRIPTION)
    return res
      .type('text/html')
      .send(html)
  })

  // Provide a custom meta title and description for FAQ
  app.get('/faq/*', (req, res, next) => {
    const question = decodeURI(req.path.replace('/faq/', '')).replace(/-/g, ' ')
    const item = faq.find(item => item.q.replace(/\?/, '') === question)
    if (!item) {
      return next()
    }
    const html = htmlFile
      .replace('__OG_TITLE__', item.q)
      .replace('__OG_DESCRIPTION__', item.a)
    return res
      .type('text/html')
      .send(html)
  })

  app.use(express.static(path.join(__dirname, 'client/build')))

  // Redirect all other routes not handled
  app.get('*', async (req, res) => {
    const html = htmlFile
      .replace('__OG_TITLE__', DEFAULT_META_TITLE)
      .replace('__OG_DESCRIPTION__', DEFAULT_META_DESCRIPTION)
    return res
      .type('text/html')
      .send(html)
  })

  return app
}

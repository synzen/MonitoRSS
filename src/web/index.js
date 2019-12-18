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
const mongoose = require('mongoose')
const app = express()
const http = require('http').Server(app)
const log = require('../util/logger.js')
const fetchUser = require('./util/fetchUser.js')
const PORT = TEST_ENV ? 8081 : config.web.port
const REDIRECT_URI = config.web.redirectUri
const sharedSession = require('express-socket.io-session')
const SCOPES = 'identify guilds'
const tokenConfig = code => { return { code, redirect_uri: REDIRECT_URI, scope: SCOPES } }
const faq = JSON.parse(fs.readFileSync(path.join(__dirname, 'client', `src`, 'js', 'constants', 'faq.json')))
const htmlFile = fs.readFileSync(path.join(__dirname, 'client/build', 'index.html')).toString()
const requestIp = require('request-ip')
const AuthPathAttempts = require('./util/AuthPathAttempts.js')
const attemptedPaths = new AuthPathAttempts()

let httpIo = require('socket.io').listen(http)
let https
let httpsIo
let httpsPort
if (config.web && config.web.https && config.web.https.enabled === true) {
  const { privateKey, certificate, chain, port } = config.web.https
  if (!privateKey || !certificate || !chain) throw new Error('Missing private key, certificate, or chain file path for enabled https')
  const fs = require('fs')
  const key = fs.readFileSync(privateKey, 'utf8')
  const cert = fs.readFileSync(certificate, 'utf8')
  const ca = fs.readFileSync(chain, 'utf8')
  httpsPort = port
  https = require('https').Server({ key, cert, ca }, app)
  httpsIo = require('socket.io').listen(https)
}

const credentials = {
  client: {
    id: config.web.clientId,
    secret: config.web.clientSecret
  },
  auth: discordAPIConstants.auth
}
const oauth2 = require('simple-oauth2').create(credentials)
if (!TEST_ENV) {
  const { clientId, clientSecret, port } = config.web
  if (!clientId || !clientSecret || !port) {
    throw new Error(`Missing required info for web (Client ID Exists: ${!!clientId}, Client Secret Exists: ${!!clientSecret}, Web Port Exists: ${!!port})`)
  }
}

module.exports = () => {
  if (TEST_ENV) {
    mongoose.connect(config.database.uri, { useNewUrlParser: true })
    mongoose.set('useCreateIndex', true)
    return start(mongoose.connection)
  }
  if (!storage.redisClient) {
    throw new Error('Redis is not connected for Web UI')
  }
  start()
  return {
    enableCP: () => {
      if (!config.database.uri.startsWith('mongo')) {
        return log.web.warning('Ignoring control panel enable instruction due to databaseless configuration')
      }
      app.set('cpEnabled', true)
      httpIo.sockets.emit('DRSS_BOT_READY')
      if (httpsIo) {
        httpsIo.sockets.emit('DRSS_BOT_READY')
      }
    },
    disableCP: () => app.set('cpEnabled', false)
  }
}

function start () {
  if (config.web.trustProxy) {
    app.enable('trust proxy')
  }

  // Middleware
  if (config.web.https.enabled) {
    app.use(function (req, res, next) {
      if (!req.secure) res.redirect('https://' + req.headers.host + req.url)
      else next()
    })
  }
  app.use(compression())
  app.use(function mongoAndCORS (req, res, next) {
    // Disallow CORS
    // res.header('Access-Control-Allow-Origin', '*')
    // res.header('Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept')
    next()
  })
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

    httpIo.use(sharedSession(session, { autoSave: true }))
    require('./redis/index.js')(httpIo, httpsIo)
    require('./websockets/index.js')(httpIo, false)
    if (httpsIo) {
      httpsIo.use(sharedSession(session, { autoSave: true }))
      require('./websockets/index.js')(httpsIo, true)
    }
  }

  // Application-specific variables
  app.set('oauth2', oauth2)

  // Routes
  app.use(express.static(path.join(__dirname, 'client/build')))
  app.use('/api', apiRoutes.router)

  app.get('/login', (req, res) => {
    const authorizationUri = oauth2.authorizationCode.authorizeURL({
      redirect_uri: REDIRECT_URI,
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
      const result = await oauth2.authorizationCode.getToken(tokenConfig(req.query.code))
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

  if (TEST_ENV) {
    app.post('/session', (req, res, next) => {
      req.session.auth = req.body.auth
      req.session.identity = req.body.identity
      res.end('ok')
    })
  }

  // Redirect all other routes not handled
  app.get('*', async (req, res) => {
    res.type('text/html')
    const pathLowercase = req.path.toLowerCase()
    if (pathLowercase.startsWith('/cp') && (!req.session.identity || !req.session.auth)) {
      // Save the path to redirect them later after they're authorized
      const ip = requestIp.getClientIp(req)
      if (ip) attemptedPaths.add(ip, req.path)
    }
    let returnFaqHTML = pathLowercase.startsWith('/faq')
    let matchedFaqItem

    if (returnFaqHTML) {
      const question = decodeURI(req.path.replace('/faq/', '')).replace(/-/g, ' ')
      const item = faq.find(item => item.q.replace(/\?/, '') === question)
      if (!item) {
        returnFaqHTML = false
      } else {
        matchedFaqItem = item
      } 
    }

    if (!returnFaqHTML) {
      return res.send(htmlFile.replace('__OG_TITLE__', 'Under Construction').replace('__OG_DESCRIPTION__', 'This site is currently under construction.'))
    } else {
      return res.send(htmlFile.replace('__OG_TITLE__', matchedFaqItem.q).replace('__OG_DESCRIPTION__', matchedFaqItem.a))
    }
  })

  if (!TEST_ENV) {
    http.listen(PORT, () => log.web.success(`HTTP UI listening on port ${PORT}!`))
    if (https) https.listen(httpsPort, () => log.web.success(`HTTPS UI listening on port ${httpsPort}!`))
  }

  return app
}

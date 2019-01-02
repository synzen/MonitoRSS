// const path = require('path')
const TEST_ENV = process.env.NODE_ENV === 'test'
const axios = require('axios')
const morgan = require('morgan')
const express = require('express')
const session = require('express-session')
const rateLimit = require('express-rate-limit')
const MongoStore = require('connect-mongo')(session)
const discordAPIConstants = require('./constants/discordAPI.js')
const discordAPIHeaders = require('./constants/discordAPIHeaders.js')
const apiRoutes = require('./routes/api/index.js')
const mongoose = require('mongoose')
const app = express()
require('express-ws')(app) // Websockets
const PORT = TEST_ENV ? 8081 : process.env.DRSS_PORT
const REDIRECT_URI = process.env.DRSS_REDIRECT_URI
const SCOPES = 'identify guilds'
const tokenConfig = code => { return { code, redirect_uri: REDIRECT_URI, scope: SCOPES } }

const credentials = {
  client: {
    id: process.env.DRSS_CLIENT_ID,
    secret: process.env.DRSS_CLIENT_SECRET
  },
  auth: discordAPIConstants.auth
}
const oauth2 = require('simple-oauth2').create(credentials)
if (!TEST_ENV && (!process.env.DRSS_CLIENT_ID || !process.env.DRSS_CLIENT_SECRET || !process.env.DRSS_PORT)) throw new Error('Missing Cient ID, Secret and/or Port in environment')

module.exports = () => {
  if (TEST_ENV) {
    mongoose.connect('mongodb://localhost:27017/rss_test', { useNewUrlParser: true })
    mongoose.set('useCreateIndex', true)
    return start(mongoose.connection)
  } else if (mongoose.connection.readyState === 1) start(mongoose.connection)
  else require('../rss/db/connect.js')().then(() => start(mongoose.connection)).catch(console.log)
}

function start (mongooseConnection) {
  // Middleware
  if (!TEST_ENV) app.use(morgan('dev')) // Logging requests
  app.use(function mongoAndCORS (req, res, next) {
    // Make sure the database connection works on every API request
    if (!TEST_ENV && mongoose.connection.readyState !== 1) {
      console.log('Ingoring request due to mongoose readyState !== 1')
      return res.status(500).json({ status: 500, message: 'Internal Server Error' })
    }
    // Allow CORS?
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept')
    next()
  })
  app.use(express.json())

  // Sessions
  app.set('trust proxy', 1) // trust first proxy
  app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set secure to true for HTTPS - otherwise sessions will not be saved
    store: new MongoStore({
      // Recycle connection if possible
      mongooseConnection,
      ttl: 7 * 24 * 60 * 60 // 7 days expiration in the mongo db
    })
  }))

  // Application-specific variables
  app.set('oauth2', oauth2)

  // Routes
  // app.use(express.static(path.join(__dirname, 'client/build')))
  if (!TEST_ENV) {
    app.use('/api', rateLimit({
      windowMs: 5 * 1000, // 5 seconds
      max: 15, // 15 requests per 5 seconds
      message: {
        status: '429',
        message: 'Too many requests'
      }
    }))
  }
  app.use('/api', apiRoutes)

  app.get('/test', (req, res) => {
    return res.end()
  })

  app.get('/login', (req, res) => {
    const authorizationUri = oauth2.authorizationCode.authorizeURL({
      redirect_uri: REDIRECT_URI,
      scope: SCOPES
    })
    res.redirect(authorizationUri)
  })

  app.get('/logout', (req, res, next) => {
    oauth2.accessToken.create(req.session.auth).revokeAll()
      .then(res => req.session.destroy(err => err ? next(err) : res.send('OK')))
      .catch(next)
  })

  app.get('/authorize', (req, res, next) => {
    oauth2.authorizationCode.getToken(tokenConfig(req.query.code))
      .then(result => { // keys access_token, token_type = 'Bearer', expires_in, refresh_token, scope
        const accessTokenObject = oauth2.accessToken.create(result) // class with properties access_token, token_type = 'Bearer', expires_in, refresh_token, scope, expires_at
        req.session.auth = accessTokenObject.token
        return axios.get(`${discordAPIConstants.apiHost}/users/@me`, discordAPIHeaders.user(req.session.auth.access_token))
      })
      .then(resp => {
        req.session.identity = resp.data
        // res.redirect('/')
        res.send('Authenticated session is now stored. Run the react development server ("npm start") in ./client, and work from there. All API requests to both Discord and this server will be authenticated.')
      })
      .catch(next)
  })

  if (TEST_ENV) {
    app.post('/session', (req, res, next) => {
      req.session.auth = req.body.auth
      req.session.identity = req.body.identity
      res.end('ok')
    })
  }

  // Websockets
  app.ws('/ping', (ws, req) => {
    ws.on('message', msg => {
      console.log(`Websocket message:`, msg)
      ws.send(`I, the server, have seen your message (${msg}): ` + new Date())
    })
  })

  // Redirect all other routes not handled
  // app.get('/', (req, res) => {
  //   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  // })

  if (!TEST_ENV) app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
  return app
}

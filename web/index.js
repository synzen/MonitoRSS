// const path = require('path')
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
const PORT = process.env.DRSS_PORT
const REDIRECT_URI = process.env.DRSS_REDIRECT_URI
const SCOPES = 'identify guilds'
const tokenConfig = code => { return { code, redirect_uri: REDIRECT_URI, scope: SCOPES } }
const apiLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 15, // 15 requests per 5 seconds
  message: {
    status: '429',
    message: 'Too many requests'
  }
})

const credentials = {
  client: {
    id: process.env.DRSS_CLIENT_ID,
    secret: process.env.DRSS_CLIENT_SECRET
  },
  auth: discordAPIConstants.auth
}
const oauth2 = require('simple-oauth2').create(credentials)

if (!process.env.DRSS_CLIENT_ID || !process.env.DRSS_CLIENT_SECRET || !process.env.DRSS_PORT) throw new Error('Missing Cient ID, Secret and/or Port in environment')

module.exports = () => {
  if (mongoose.connection.readyState === 1) start(mongoose.connection)
  else require('../rss/db/connect.js')().then(() => start(mongoose.connection)).catch(console.log)
}

function start (mongooseConnection) {
  // Middleware
  app.use(morgan('dev')) // Logging requests
  app.use(function mongoAndCORS (req, res, next) {
    // Make sure the database connection works on every API request
    if (mongoose.connection.readyState !== 1) return res.status(500).json({ status: 500, message: 'Internal server error' })
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
  app.use('/api', apiLimiter, apiRoutes)

  app.get('/test', (req, res) => {
    res.send('ok')
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

  // Websockets
  app.ws('/ping', (ws, req) => {
    ws.on('message', msg => {
      console.log(`Websocket message:`,msg)
      ws.send(`I, the server, have seen your message (${msg}): ` + new Date())
    })
  })

  // Redirect all other routes not handled
  // app.get('/', (req, res) => {
  //   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  // })

  app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
}

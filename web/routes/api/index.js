const express = require('express')
const users = require('./users.js')
const guilds = require('./guilds.js')
const log = require('../../../util/logger.js')
const dbOps = require('../../../util/dbOps.js')
const api = express.Router()
const cp = require('./cp.js')
const feedback = require('./feedback.js')
const rating = require('./rating.js')
const feeds = require('./guilds.feeds.js')
const roles = require('./guilds.roles.js')
const feedParser = require('./feeds.js')
const message = require('./guilds.feeds.message.js')
const embeds = require('./guilds.feeds.embeds.js')
const filters = require('./guilds.feeds.filters.js')
const subscribers = require('./guilds.feeds.subscribers.js')
const subscribersFilters = require('./guilds.feeds.subscribers.filters.js')
const channels = require('./guilds.channels.js')
const statusCodes = require('../../constants/codes.js')
const csrf = require('csurf')
const rateLimit = require('express-rate-limit')
// All API routes tries to mirror Discord's own API routes

if (process.env.NODE_ENV !== 'test') {
  api.use(rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per 1 minute
    message: {
      code: 429,
      message: 'Too many requests'
    }
  }))
}

function getAuthenticated (req, res) {
  res.json({ authenticated: !!(req.session.identity && req.session.auth) })
}

async function authenticate (req, res, next) {
  if (process.env.VIP_ONLY === 'true' && req.session.identity && req.session.identity.id) {
    const vipUser = await dbOps.vips.get(req.session.identity.id)
    if (!vipUser || vipUser.invalid) {
      const manualIds = (process.env.VIPS || '').split(',').map(id => id.trim())
      if (!manualIds.includes(req.session.identity.id)) {
        log.web.warning(`(${req.session.identity.id}, ${req.session.identity.username}) DENIED API REQUEST ${req.url} - NON PATRON`)
        return res.status(401).json({ code: 9999, message: 'Unauthorized access from a non-VIP user' })
      }
    }
  }
  if (!req.session.auth) {
    if (req.session.identity) log.web.warning(`(${req.session.identity.id}, ${req.session.identity.username}) Failed Discord Authorization`)
    return res.status(401).json({ code: 401, message: 'Failed Discord authorization' })
  }
  const accessTokenObject = req.app.get('oauth2').accessToken.create(req.session.auth)
  if (!accessTokenObject.expired()) return next()
  accessTokenObject.refresh().then(result => {
    req.session.auth = result.token
    next()
  }).catch(next)
}

// Handle PATCH, POST and DELETE mongoose results
function mongooseResults (req, res) {
  if (req.method === 'PATCH' || req.method === 'POST' || req.method === 'PUT') {
    const result = req.patchResult || req.postResult || req.putResult
    if (!result) return res.end()
    if (result.ok !== 1) return res.status(500).json({ code: 500, message: statusCodes['500'].message })
    if (result.n === 0) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
    if (result.upserted) return res.status(201).json(req.guildRss)
    else if (result.nModified !== 1) return res.status(304).json({ code: 304, message: statusCodes['304'].message })
    return res.json(req.guildRss)
  } else if (req.method === 'DELETE') {
    const { deleteResult } = req
    if (!deleteResult) return res.end()
    if (deleteResult.ok !== 1) return res.status(500).json({ code: 500, message: statusCodes['500'].message })
    if (deleteResult.n === 0) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
    // nModified may also be available since the mongoose operation is sometimes "updateOne"
    if (deleteResult.nModified !== undefined && deleteResult.nModified !== 1) return res.status(304).json({ code: 304, message: statusCodes['304'].message })
    return res.status(204).end()
  } else return res.end()
}

// Handle API route errors
function errorHandler (err, req, res) {
  if (err.response) {
    if (process.env.NODE_ENV !== 'test') console.log(err.response)
    // Axios errors for Discord API calls
    const status = err.response.status
    const data = err.response.data
    const message = data ? data.message ? data.message : data : statusCodes[status] ? statusCodes[status].message : err.response.statusText
    return res.status(status).json({ code: status, message, discord: true })
  } else if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ code: 403, message: 'Bad CSRF Token' })
  } else {
    if (process.env.NODE_ENV !== 'test') console.log(err)
    res.status(500).json({ code: 500, message: statusCodes['500'].message })
  }
}

api.get('/authenticated', getAuthenticated)
api.use('/feeds', feedParser.router)

// Any routes defined past here requires authorization
api.use(authenticate)

if (process.env.NODE_ENV !== 'test') api.use(csrf())
api.use('/cp', cp.router)
api.use('/feedback', feedback)
api.use('/rating', rating)
// api.use('/config', config)
api.use('/users', users.router)
api.use('/guilds', guilds.router)
guilds.router.use('/:guildId/feeds', feeds.router)
guilds.router.use('/:guildId/roles', roles.router)
guilds.router.use('/:guildId/channels', channels.router)
feeds.router.use('/:feedId/message', message.router)
feeds.router.use('/:feedId/embeds', embeds.router)
feeds.router.use('/:feedId/filters', filters.router)
feeds.router.use('/:feedId/subscribers', subscribers.router)
feeds.router.use('/:feedId/subscribers/:subscriberId/filters', subscribersFilters.router)
api.use(mongooseResults)
api.use(errorHandler)

module.exports = {
  router: api,
  middleware: {
    authenticate,
    mongooseResults,
    errorHandler
  },
  routes: {
    getAuthenticated
  }
}

const express = require('express')
const feedSubscriptions = express.Router({ mergeParams: true })
const dbOps = require('../../../util/dbOps.js')
const isObject = obj => typeof obj === 'object' && obj !== null && !Array.isArray(obj)
const redisOps = require('../../../util/redisOps.js')

function checkSubscriptionExist (req, res, next) {
  const id = req.params.subscriberId
  const source = req.source
  const subscribers = source.subscribers
  if (!subscribers) return res.status(404).json({ code: 404, message: 'Unknown Subscriber' })
  for (let i = 0; i < subscribers.length; ++i) {
    const subscriber = subscribers[i]
    if (subscriber.id === id) {
      req.subscriberIndex = i
      return next()
    }
  }
  return res.status(404).json({ code: 404, message: 'Unknown Subscriber' })
}

async function putFeedSubscription (req, res, next) {
  // TO DO: If user support is ever added, the tests must be written
  try {
    const guildId = req.guildRss.id // Provided earlier in the middleware
    const type = req.body.type
    const id = req.body.id
    const filters = req.body.filters
    const errors = {}
    const toPush = { type: type, id: id }
    if (!id) errors.id = 'This field is required'
    if (type !== 'role') errors.type = 'Must be "role"' // errors.type = 'Must be "role" or "user"'
    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })
    // if (type === 'user') {
    //   const cached = await redisOps.users.get(id)
    //   if (cached) toPush.name = cached.username
    //   else {
    //     return res.status(401).json({ code: 401, message: 'Unsupported' })
    // log.web.info(`[1 DISCORD API REQUEST] [BOT] POST /api/guilds/:guildId/feeds/:feedId/subscribers`)
    // const response = (await axios.get(`${discordAPIConstants.apiHost}/users/${id}`, BOT_HEADERS))
    // toPush.name = response.data.username
    // }
    // } else {
    const [ partOfGuild, roleName ] = await Promise.all([ redisOps.roles.isRoleOfGuild(id, guildId), redisOps.roles.getValue(id, 'name') ])
    if (!partOfGuild) return res.status(403).json({ code: 403, message: `Role is not in guild` })
    if (roleName === '@everyone') return res.status(403).json({ code: 403, message: '@everyone role cannot be a subscriber' })
    toPush.name = roleName
    // }

    if (filters !== undefined && (typeof filters !== 'object' || filters === null || Array.isArray(filters))) return res.status(400).json({ code: 400, message: { filters: 'Must be undefined or a non-Array object' } })
    if (filters && Object.keys(filters).length === 0) return res.status(400).json({ code: 400, message: { filters: 'Cannot be an empty object' } })
    if (req.source.subscribers) {
      for (const subscriber of req.source.subscribers) {
        if (subscriber.id === id) return res.status(400).json({ code: 400, message: { id: 'Already exists' } })
      }
    }
    if (filters) toPush.filters = filters
    if (!req.source.subscribers) req.source.subscribers = []
    req.source.subscribers.push(toPush)
    await dbOps.guildRss.update(req.guildRss)
    res.status(201).json(toPush)
  } catch (err) {
    next(err)
  }
}

feedSubscriptions.put('/', putFeedSubscription)

feedSubscriptions.use('/:subscriberId', checkSubscriptionExist)

async function patchFeedSubscription (req, res, next) {
  try {
    const filters = req.body.filters
    const source = req.source
    const errors = {}
    for (const key in req.body) {
      if (key !== 'filters') errors[key] = 'Invalid setting'
    }
    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })
    if (filters !== '' && (filters === undefined || filters === null)) return res.status(400).json({ code: 400, message: { filters: 'Must be populated if not an empty string' } })
    if (filters !== '' && !isObject(filters)) return res.status(400).json({ code: 400, message: { filters: 'Must be an object' } })
    else if (filters !== '' && Object.keys(filters).length === 0) return res.status(400).json({ code: 400, message: { filters: 'Must be populated' } })
    else if (filters === '' && !source.subscribers[req.subscriberIndex].filters) return res.status(400).json({ code: 400, message: 'Already a global subscriber' })
    // Delete it from global and move it to filtered
    const subscriber = source.subscribers[req.subscriberIndex]
    if (filters === '') delete subscriber.filters
    else subscriber.filters = filters

    const result = await dbOps.guildRss.update(req.guildRss)
    req.patchResult = result
    next()
  } catch (err) {
    next(err)
  }
}

async function deleteFeedSubscription (req, res, next) {
  try {
    req.source.subscribers.splice(req.subscriberIndex, 1)
    if (req.source.subscribers.length === 0) delete req.source.subscribers
    const result = await dbOps.guildRss.update(req.guildRss)
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
}

feedSubscriptions.patch('/:subscriberId', patchFeedSubscription)
feedSubscriptions.delete('/:subscriberId', deleteFeedSubscription)

module.exports = {
  middleware: {
    checkSubscriptionExist
  },
  routes: {
    putFeedSubscription,
    patchFeedSubscription,
    deleteFeedSubscription
  },
  router: feedSubscriptions
}

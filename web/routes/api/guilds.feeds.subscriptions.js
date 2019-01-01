const axios = require('axios')
const express = require('express')
const feedSubscriptions = express.Router({ mergeParams: true })
const dbOps = require('../../../util/dbOps.js')
const GLOBAL_SUBSCRIPTION_KEY = 'globalSubscription'
const FILTERED_SUBSCRIPTION_KEY = 'filteredSubscription'
const discordAPIConstants = require('../../constants/discordAPI.js')
const BOT_HEADERS = require('../../constants/discordAPIHeaders.js').bot

async function checkGlobalSubscriptionExist (req, res, next) {
  try {
    const id = req.params.subscriberId
    const source = req.source
    const keys = [GLOBAL_SUBSCRIPTION_KEY, FILTERED_SUBSCRIPTION_KEY]
    for (const key of keys) {
      if (!source[key]) continue
      const subscribers = source[key]
      for (let i = 0; i < subscribers.length; ++i) {
        if (subscribers[i].id === id) {
          req.subscriberType = key
          req.subscriberIndex = i
          return next()
        }
      }
    }
    return res.status(404).json({ code: 404, message: 'Unknown Subscriber' })
  } catch (err) {
    next(err)
  }
}

feedSubscriptions.post('/', async (req, res, next) => {
  try {
    const type = req.body.type
    const id = req.body.id
    const filters = req.body.filters
    const errors = {}

    if (!id) errors.id = 'This field is required'
    if (type !== 'role' && type !== 'user') errors.type = 'Must be "role" or "user"'
    else if (id) {
      if (type === 'user') await axios.get(`${discordAPIConstants.apiHost}/users/${id}`, BOT_HEADERS)
      else {
        const validRole = req.guildRoles.reduce((total, cur) => total || (cur.id === id), false) // Provided earlier in the middleware for /guilds/:guildId
        if (!validRole) return res.status(403).json({ code: 403, message: { id: [`Role is not in guild`] } })
      }
    }

    if (filters && (typeof req.filters !== 'object' || filters === null || Array.isArray(filters))) errors.filters = 'This field must be undefined or a JSON object'

    // Check whether the id is valid
    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })

    const toPush = { type: type, id: id }
    if (filters) {
      toPush.filters = filters
      if (!req.source[FILTERED_SUBSCRIPTION_KEY]) req.source[FILTERED_SUBSCRIPTION_KEY] = []
      req.source[FILTERED_SUBSCRIPTION_KEY].push(toPush)
    } else {
      if (!req.source[GLOBAL_SUBSCRIPTION_KEY]) req.source[GLOBAL_SUBSCRIPTION_KEY] = []
      req.source[GLOBAL_SUBSCRIPTION_KEY].push(toPush)
    }

    const result = await dbOps.guildRss.update(req.guildRss)
    req.postResult = result
    next()
  } catch (err) {
    next(err)
  }
})

feedSubscriptions.use('/:subscriberId', checkGlobalSubscriptionExist)

feedSubscriptions.delete('/:subscriberId', async (req, res, next) => {
  try {
    req.source[req.subscriberType].splice(req.subscriberIndex, 1)
    const result = await dbOps.guildRss.update(req.guildRss)
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
})

feedSubscriptions.patch('/:subscriberId', async (req, res, next) => {
  try {
    const filters = req.body.filters
    if (!filters) return res.status(400).json({ code: 400, message: { filters: ['This field is required. Only filters may be patched'] } })
    if (req.subscriberType === GLOBAL_SUBSCRIPTION_KEY) {
      // If it's already a global, delete it from global and move it to filtered
      const subscriber = req.sources[GLOBAL_SUBSCRIPTION_KEY][req.subscriberIndex]
      req.sources[GLOBAL_SUBSCRIPTION_KEY].splice(req.subscriberIndex, 1)
      subscriber.filters = filters
      req.sources[FILTERED_SUBSCRIPTION_KEY].push(subscriber)
      if (req.sources[GLOBAL_SUBSCRIPTION_KEY].length === 0) delete req.sources[GLOBAL_SUBSCRIPTION_KEY]
    } else {
      const subscriber = req.sources[FILTERED_SUBSCRIPTION_KEY][req.subscriberIndex]
      subscriber.filters = filters
    }
    const result = await dbOps.guildRss.update(req.guildRss)
    req.patchResult = result
    next()
  } catch (err) {
    next(err)
  }
})

module.exports = feedSubscriptions

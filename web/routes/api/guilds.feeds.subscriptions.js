const axios = require('axios')
const express = require('express')
const feedSubscriptions = express.Router({ mergeParams: true })
const dbOps = require('../../../util/dbOps.js')
const GLOBAL_SUBSCRIPTION_KEY = 'globalSubscriptions'
const FILTERED_SUBSCRIPTION_KEY = 'filteredSubscriptions'
const discordAPIConstants = require('../../constants/discordAPI.js')
const BOT_HEADERS = require('../../constants/discordAPIHeaders.js').bot
const isObject = obj => typeof obj === 'object' && obj !== null && !Array.isArray(obj)

async function checkGlobalSubscriptionExist (req, res, next) {
  try {
    const id = req.params.subscriberId
    if (!id) return res.status(400).json({ code: 400, message: 'This field is required' })
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
    const toPush = { type: type, id: id }
    if (!id) errors.id = 'This field is required'
    if (type !== 'role' && type !== 'user') errors.type = 'Must be "role" or "user"'
    else if (id) {
      if (type === 'user') toPush.name = (await axios.get(`${discordAPIConstants.apiHost}/users/${id}`, BOT_HEADERS)).data.username
      else {
        const filtered = req.guildRoles.filter(role => role.id === id) // Provided earlier in the middleware for /guilds/:guildId
        if (filtered.length === 0) return res.status(403).json({ code: 403, message: { id: `Role is not in guild` } })
        toPush.name = filtered[0].name
      }
    }

    if (filters && (typeof filters !== 'object' || filters === null || Array.isArray(filters))) errors.filters = 'This field must be undefined or a JSON object'

    // Check whether the id is valid
    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })

    if (filters) {
      toPush.filters = filters
      if (!req.source[FILTERED_SUBSCRIPTION_KEY]) req.source[FILTERED_SUBSCRIPTION_KEY] = []
      req.source[FILTERED_SUBSCRIPTION_KEY].push(toPush)
    } else {
      if (!req.source[GLOBAL_SUBSCRIPTION_KEY]) req.source[GLOBAL_SUBSCRIPTION_KEY] = []
      req.source[GLOBAL_SUBSCRIPTION_KEY].push(toPush)
    }
    await dbOps.guildRss.update(req.guildRss)
    res.status(201).json(toPush)
  } catch (err) {
    next(err)
  }
})

feedSubscriptions.use('/:subscriberId', checkGlobalSubscriptionExist)

feedSubscriptions.patch('/:subscriberId', async (req, res, next) => {
  try {
    const filters = req.body.filters
    const source = req.source
    if (!isObject(filters)) return res.status(400).json({ code: 400, message: { filters: 'This field must be a object' } })
    if (req.subscriberType === GLOBAL_SUBSCRIPTION_KEY) {
      if (Object.keys(filters).length === 0) return res.status(304).json({ code: 400, message: 'Already a global subscriber' })
      // Delete it from global and move it to filtered
      const subscriber = source[GLOBAL_SUBSCRIPTION_KEY][req.subscriberIndex]
      source[GLOBAL_SUBSCRIPTION_KEY].splice(req.subscriberIndex, 1)
      subscriber.filters = filters
      if (!source[FILTERED_SUBSCRIPTION_KEY]) source[FILTERED_SUBSCRIPTION_KEY] = []
      source[FILTERED_SUBSCRIPTION_KEY].push(subscriber)
      if (source[GLOBAL_SUBSCRIPTION_KEY].length === 0) delete source[GLOBAL_SUBSCRIPTION_KEY]
    } else {
      const subscriber = source[FILTERED_SUBSCRIPTION_KEY][req.subscriberIndex]
      if (Object.keys(filters).length === 0) {
        // Move them to globalSubscriptions
        source[FILTERED_SUBSCRIPTION_KEY].splice(req.subscriberIndex, 1)
        delete subscriber.filters
        if (!source[GLOBAL_SUBSCRIPTION_KEY]) source[GLOBAL_SUBSCRIPTION_KEY] = []
        source[GLOBAL_SUBSCRIPTION_KEY].push(subscriber)
        if (source[FILTERED_SUBSCRIPTION_KEY].length === 0) delete source[FILTERED_SUBSCRIPTION_KEY]
      } else subscriber.filters = filters
    }

    const result = await dbOps.guildRss.update(req.guildRss)
    req.patchResult = result
    next()
  } catch (err) {
    next(err)
  }
})

feedSubscriptions.delete('/:subscriberId', async (req, res, next) => {
  try {
    req.source[req.subscriberType].splice(req.subscriberIndex, 1)
    if (req.source[req.subscriberType].length === 0) delete req.source[req.subscriberType]
    const result = await dbOps.guildRss.update(req.guildRss)
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
})

module.exports = feedSubscriptions

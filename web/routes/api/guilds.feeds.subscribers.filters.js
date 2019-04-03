const express = require('express')
const subscriberFilters = express.Router({ mergeParams: true })
const { middleware, filterFuncs } = require('./guilds.feeds.filters')

function validSubscriber (req, res, next) {
  const reqSubscriberId = req.params.subscriberId
  const source = req.source
  const subscribers = source.subscribers
  if (subscribers) {
    for (const subscriber of subscribers) {
      if (subscriber.id === reqSubscriberId) {
        req.subscriber = subscriber
        return next()
      }
    }
  }
  res.status(404).json({ code: 404, message: 'Unknown Subscriber' })
}

subscriberFilters.use(validSubscriber, middleware.validBody)

// async function deleteSubscriberFilters (req, res, next) {
//   try {
//     const { filters } = req.subscriber
//     if (!filters) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
//     const { type, term } = req.body
//     if (term === '*' || type === '*') delete req.subscriber.filters
//     else if (!filters[type] || !filters[type].includes(term)) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
//     else {
//       filters[type].splice(filters[type].indexOf(term), 1)
//       if (filters[type].length === 0) delete filters[type]
//       if (Object.keys(filters).length === 0) delete req.subscriber.filters
//     }
//     const result = await dbOps.guildRss.update(req.guildRss)
//     const guildId = req.params.guildId
//     // log.web.info(`(${req.session.identity.id}, ${req.session.identity.username}) POST ${req.url} - Guild ${guildId} removed filter type ${type}, term ${term}`)
//     req.deleteResult = result
//     next()
//   } catch (err) {
//     next(err)
//   }
// }

// async function putSubscriberFilters (req, res, next) {
//   try {
//     const guildId = req.params.guildId
//     let { filters } = req.subscriber
//     const type = req.body.type
//     const term = req.body.term.toLowerCase()
//     if (filters && filters[type] && filters[type].includes(term)) return res.status(409).json({ code: 409, message: 'Already exists' }) // 409 Conflict
//     if (!filters) req.subscriber.filters = {}
//     filters = req.subscriber.filters
//     if (!filters[type]) filters[type] = [ term ]
//     else filters[type].push(term)
//     const result = await dbOps.guildRss.update(req.guildRss)
//     // log.web.info(`(${req.session.identity.id}, ${req.session.identity.username}) POST ${req.url} - Guild ${guildId} added filter type ${type}, term ${term}`)
//     req.patchResult = result // Piggyback on patchResult
//     next()
//   } catch (err) {
//     next(err)
//   }
// }

const deleteSubscriberFilters = (req, res, next) => filterFuncs.deleteFilters(req, res, next)(req.subscriber)
const putSubscriberFilters = (req, res, next) => filterFuncs.putFilters(req, res, next)(req.subscriber)

subscriberFilters.delete('/', deleteSubscriberFilters)
subscriberFilters.put('/', putSubscriberFilters)

module.exports = {
  middleware: {
    validSubscriber
  },
  routes: {
    deleteSubscriberFilters,
    putSubscriberFilters
  },
  router: subscriberFilters
}

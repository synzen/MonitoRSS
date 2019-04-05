const express = require('express')
const feedFilters = express.Router({ mergeParams: true })
const dbOps = require('../../../util/dbOps.js')

function validBody (req, res, next) {
  const errors = {}
  for (const key in req.body) {
    const val = req.body[key]
    if (key !== 'term' && key !== 'type') errors[key] = 'Invalid setting'
    else {
      if (typeof val !== 'string') errors[key] = 'Must be a string'
      else if (!val) errors[key] = 'Must be populated'
      else if (val.length > 1000) errors[key] = 'Must be fewer than 1000 characters'
    }
  }
  if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })
  next()
}

const deleteFilters = (req, res, next) => async target => {
  try {
    const { filters } = target
    if (!filters) return res.status(404).json({ code: 404, message: 'Unknown filters' })
    const { type, term } = req.body
    if (term === '*' && type === '*') delete target.filters
    else if (!filters[type] || !filters[type].includes(term)) return res.status(404).json({ code: 404, message: 'Unknown filter' })
    else {
      filters[type].splice(filters[type].indexOf(term), 1)
      if (filters[type].length === 0) delete filters[type]
      if (Object.keys(filters).length === 0) delete target.filters
    }
    const result = await dbOps.guildRss.update(req.guildRss)
    // const guildId = req.params.guildId
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
}

const putFilters = (req, res, next) => async target => {
  try {
    // const guildId = req.params.guildId
    let { filters } = target
    const type = req.body.type
    const term = req.body.term.toLowerCase()
    if (filters && filters[type] && filters[type].includes(term)) return res.status(409).json({ code: 409, message: 'Already exists' }) // 409 Conflict
    if (!filters) target.filters = {}
    filters = target.filters
    if (!filters[type]) filters[type] = [ term ]
    else filters[type].push(term)
    const result = await dbOps.guildRss.update(req.guildRss)
    req.putResult = result // Piggyback on patchResult
    next()
  } catch (err) {
    next(err)
  }
}

const deleteFeedFilters = (req, res, next) => deleteFilters(req, res, next)(req.source)
const putFeedFilters = (req, res, next) => putFilters(req, res, next)(req.source)

feedFilters.delete('/', validBody, deleteFeedFilters)
feedFilters.put('/', validBody, putFeedFilters)

module.exports = {
  middleware: {
    validBody
  },
  filterFuncs: {
    deleteFilters,
    putFilters
  },
  routes: {
    deleteFeedFilters,
    putFeedFilters
  },
  router: feedFilters
}

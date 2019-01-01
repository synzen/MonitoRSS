const express = require('express')
const feedFilters = express.Router({ mergeParams: true })
const dbOps = require('../../../util/dbOps.js')
const statusCodes = require('../../constants/codes.js')

feedFilters.delete('/', async (req, res, next) => {
  try {
    if (!req.source.filters) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
    delete req.source.filters
    const result = await dbOps.guildRss.update(req.guildRss)
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
})

feedFilters.patch('/', async (req, res, next) => {
  try {
    if (!req.body.filters) return res.status(400).json({ code: 400, message: { filters: 'This is a required field' } })
    if (typeof req.body.filters !== 'object' || req.body.filters === null || Array.isArray(req.body.filters)) return res.status(400).json({ code: 400, message: { filters: ['Must be a JSON object'] } })
    req.source.filters = req.body.filters
    const result = await dbOps.guildRss.update(req.guildRss)
    req.patchResult = result
    next()
  } catch (err) {
    next(err)
  }
})

module.exports = feedFilters

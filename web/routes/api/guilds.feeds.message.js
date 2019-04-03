const express = require('express')
const feedMessage = express.Router({ mergeParams: true })
const dbOps = require('../../../util/dbOps.js')

async function deleteFeedMessage (req, res, next) {
  try {
    if (!req.source.message) return res.status(404).json({ code: 404, message: 'Unknown feed message' })
    delete req.source.message
    const result = await dbOps.guildRss.update(req.guildRss)
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
}

async function patchFeedMessage (req, res, next) {
  try {
    const newMessage = req.body.message
    const errors = {}
    for (const key in req.body) {
      if (key !== 'message') errors[key] = 'Invalid setting'
    }
    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })
    if (typeof newMessage !== 'string') return res.status(400).json({ code: 400, message: { message: 'Must be a string' } })
    if (newMessage.length === 0) return res.status(400).json({ code: 400, message: { message: 'This is a required field' } })
    if (newMessage.length > 1000) return res.status(400).json({ code: 400, message: { message: 'Must be less than or equal to 1000 characters' } })
    req.source.message = newMessage
    const result = await dbOps.guildRss.update(req.guildRss)
    req.patchResult = result
    next()
  } catch (err) {
    next(err)
  }
}

feedMessage.delete('/', deleteFeedMessage)
feedMessage.patch('/', patchFeedMessage)

module.exports = {
  routes: {
    deleteFeedMessage,
    patchFeedMessage
  },
  router: feedMessage
}

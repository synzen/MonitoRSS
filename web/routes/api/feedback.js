const express = require('express')
const feedback = express.Router({ mergeParams: true })
const dbOps = require('../../../util/dbOps.js')
const rateLimit = require('express-rate-limit')

if (process.env.NODE_ENV !== 'test') {
  feedback.use(rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minute
    max: 3, // 3 requests per 5 minute
    message: {
      code: 429,
      message: 'Too many requests'
    }
  }))
}

feedback.post('/', async (req, res, next) => {
  const { id, username } = req.session.identity
  const message = req.body.message
  if (!message) return res.status(400).json({ code: 400, message: { message: 'This field is required' } })
  else if (typeof message !== 'string') return res.status(400).json({ code: 400, message: { message: 'Must be a string' } })
  try {
    await dbOps.general.addFeedback({ id, username }, message, 'web')
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

module.exports = feedback

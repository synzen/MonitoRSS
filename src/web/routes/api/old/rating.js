const express = require('express')
const rating = express.Router({ mergeParams: true })
const dbOpsGeneral = require('../../../util/db/general.js')

rating.post('/', async (req, res, next) => {
  const { id, username } = req.session.identity
  const rating = req.body.rating
  if (!rating) return res.status(400).json({ code: 400, message: { rating: 'This field is required' } })
  else if (isNaN(rating)) return res.status(400).json({ code: 400, message: { rating: 'Must be a number' } })
  try {
    await dbOpsGeneral.addRating({ id, username }, parseInt(rating, 10), 'web')
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

module.exports = rating

const express = require('express')
const router = express.Router()
const configJson = require('../../../config.json')

router.get('/', async (req, res, next) => {
  res.json(configJson.feeds)
})

module.exports = router

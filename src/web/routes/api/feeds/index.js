const express = require('express')
const feedsAPI = express.Router()

// Remember for stricter rate limit for unauthenticated getFeed

feedsAPI.get('/:url', require('../../../controllers/api/feeds/getFeed.js')())

module.exports = feedsAPI

const express = require('express')
const guildsAPIFailRecords = express.Router({ mergeParams: true })
const controllers = require('../../../../controllers/index.js')

guildsAPIFailRecords.get('/', controllers.api.guilds.getFailRecords)

module.exports = guildsAPIFailRecords

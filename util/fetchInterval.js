/*
    Used to control feed retrieval cycle on disconnects and file updates
*/

const config = require('../config.json')
var fetchInterval
var refreshTime = (config.feedSettings.refreshTimeMinutes) ? config.feedSettings.refreshTimeMinutes : 15

exports.startSchedule = function (command) {
  fetchInterval = setInterval(command, refreshTime*60000)
}

exports.stopSchedule = function () {
  clearInterval(fetchInterval)
}

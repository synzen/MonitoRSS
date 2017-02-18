const config = require('../config.json')
var fetchInterval

exports.startSchedule = function (command) {
  fetchInterval = setInterval(command, config.feedSettings.refreshTimeMinutes*60000)
}

exports.stopSchedule = function () {
  clearInterval(fetchInterval)
}

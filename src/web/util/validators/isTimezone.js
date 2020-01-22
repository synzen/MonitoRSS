const moment = require('moment-timezone')

function isTimezone(value) {
  return !!moment.tz.zone(value)
}

module.exports = isTimezone

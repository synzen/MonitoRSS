const moment = require('moment-timezone')

function isTimezone(value) {
  if (value === '') {
    return true
  }
  return !!moment.tz.zone(value)
}

module.exports = isTimezone

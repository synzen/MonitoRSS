const config = require('../../../config.js')

function dateLanguageExists (val) {
  if (val === '') {
    return true
  }
  const list = config.feeds.dateLanguageList
  return list.includes(val)
}

module.exports = dateLanguageExists

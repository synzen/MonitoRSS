function isValidTimestamp (value) {
  if (value === '') {
    return true
  }
  return value === 'article' || value === 'now'
}

module.exports = isValidTimestamp

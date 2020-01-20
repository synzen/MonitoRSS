const AuthPathAttempts = require('../util/AuthPathAttempts.js')
const attemptedPaths = new AuthPathAttempts()

function setPath (ip, path) {
  attemptedPaths.add(ip, path)
}

function getPath (ip) {
  return attemptedPaths.get(ip)
}

module.exports = {
  setPath,
  getPath
}

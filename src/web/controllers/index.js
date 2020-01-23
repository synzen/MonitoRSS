const all = require('./all.js')
const authorize = require('./authorize.js')
const cp = require('./cp.js')
const faq = require('./faq.js')
const login = require('./login.js')
const logout = require('./logout.js')
const root = require('./root.js')
const api = require('./api/index.js')

module.exports = {
  api,
  all,
  authorize,
  cp,
  faq,
  login,
  logout,
  root
}

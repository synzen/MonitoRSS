const fs = require('fs')
const path = require('path')
const config = require('../config.js')
const locale = JSON.parse(fs.readFileSync(path.join(__dirname, `locales`, config.bot.locale)))

function escapeRegExp (str) {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}
/**
 * Convert a string according to the configurated locale
 * @param {string} string - Accessor
 * @param {string[]} [params] - Keys to replace in the string
 */
module.exports = (string, params) => {
  const properties = string.split('.')
  let accessedSoFar = locale
  for (const property of properties) {
    accessedSoFar = locale[property]
    if (!accessedSoFar) throw new Error(`Invalid locale accessor (stopped at "${property}")`)
  }
  if (typeof accessedSoFar !== 'string') throw new Error('Invalid locale accessor that stopped with a non-string value')
  for (const param of params) {
    const term = escapeRegExp(`{{${param}}}`)
    const regex = new RegExp(term, 'g')
    accessedSoFar = accessedSoFar.replace(regex, params[param])
  }
  return accessedSoFar
}

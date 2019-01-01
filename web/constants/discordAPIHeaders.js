const config = require('../../config.js')

exports.user = accessToken => {
  return {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
}

exports.bot = { headers: { 'Authorization': `Bot ${config.bot.token}` } }
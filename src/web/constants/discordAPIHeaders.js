const config = require('../../config.js')
const package = require('../../../package.json')

exports.common = {
  headers: {
    'User-Agent': `DiscordBot (${package.name}, ${package.version}) Node.js/${process.version}`
  }
}

exports.user = accessToken => {
  return {
    headers: {
      ...exports.common.headers,
      'Authorization': `Bearer ${accessToken}`
    }
  }
}

exports.bot = {
  headers: {
    ...exports.common.headers,
    'Authorization': `Bot ${config.bot.token}`
  }
}

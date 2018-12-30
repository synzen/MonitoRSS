const dbOps = require('./dbOps.js')
const config = require('../config.js')

module.exports = async serverId => {
  if (config._vip !== true) return { max: config.feeds.max || 0 }
  const vipUser = (await dbOps.vips.getAll()).filter(vipUser => vipUser.servers.includes(serverId))[0]
  config.feeds.max = config.feeds.max || 0
  const max = config.feeds.max !== 0 && vipUser && vipUser.maxFeeds && vipUser.maxFeeds > config.feeds.max ? vipUser.maxFeeds : config.feeds.max

  return { max, vipUser }
}

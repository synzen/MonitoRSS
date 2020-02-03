const getGuild = require('./getGuild.js')
const editGuild = require('./editGuild.js')
const getFailRecords = require('./getFailRecords.js')
const feeds = require('./feeds/index.js')
const channels = require('./channels/index.js')
const roles = require('./roles/index.js')

module.exports = {
  feeds,
  roles,
  channels,
  getGuild,
  editGuild,
  getFailRecords
}

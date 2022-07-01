const Supporter = require('../structs/db/Supporter.js')
const KeyValue = require('../structs/db/KeyValue.js')
const getConfig = require('../config').get

/**
 * Stores the feeds config for use by the control panel
 * that is an external process
 */
async function populateKeyValues () {
  const config = getConfig()
  await KeyValue.deleteAll()
  const feedConfigData = {
    _id: KeyValue.keys.FEED_CONFIG,
    value: {
      ...config.feeds,
      decode: {}
    }
  }
  const supporterConfigData = {
    _id: KeyValue.keys.SUPPORTER_CONFIG,
    value: {
      [Supporter.keys.ENABLED]: config[Supporter.keys.ENABLED],
      [Supporter.keys.REFRESH_RATE]: config[Supporter.keys.REFRESH_RATE]
    }
  }
  const feedsConfig = new KeyValue(feedConfigData)
  const supporterConfig = new KeyValue(supporterConfigData)
  await Promise.all([
    feedsConfig.save(),
    supporterConfig.save()
  ])
}

module.exports = populateKeyValues

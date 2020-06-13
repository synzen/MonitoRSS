const Article = require('../models/Article.js')
const DeliveryRecord = require('../models/DeliveryRecord.js')
const ensureIndexes = require('./generic/ensureIndexes.js')
const configuration = require('../config.js')
const INDEX_NAME = 'addedAt_1'

async function checkIndexes () {
  const config = configuration.get()
  if (!config.database.uri.startsWith('mongo')) {
    return
  }
  await Promise.all([
    ensureIndexes(Article.Model, INDEX_NAME, config.database.articlesExpire),
    ensureIndexes(DeliveryRecord.Model, INDEX_NAME, config.database.deliveryRecordsExpire)
  ])
}

module.exports = checkIndexes

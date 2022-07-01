const Article = require('../models/Article.js')
const DeliveryRecord = require('../models/DeliveryRecord.js')
const ensureIndexes = require('./generic/ensureIndexes.js')
const configuration = require('../config.js')
const INDEX_NAME = 'addedAt_1'

async function checkArticleIndexes () {
  const config = configuration.get()
  await ensureIndexes(Article.Model, INDEX_NAME, config.database.articlesExpire)
}

async function checkDeliveryRecordsIndexes () {
  const config = configuration.get()
  await ensureIndexes(DeliveryRecord.Model, INDEX_NAME, config.database.deliveryRecordsExpire)
}

async function checkIndexes () {
  const config = configuration.get()
  if (!config.database.uri.startsWith('mongo')) {
    return
  }
  await checkArticleIndexes()
  await checkDeliveryRecordsIndexes()
}

module.exports = {
  checkArticleIndexes,
  checkDeliveryRecordsIndexes,
  checkIndexes
}

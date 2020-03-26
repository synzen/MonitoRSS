const getConfig = require('../config.js').get
const ArticleModel = require('../models/Article.js')
const INDEX_NAME = 'addedAt_1'

/**
 * @param {number} articlesExpire
 */
async function checkIndexes (articlesExpire) {
  const config = getConfig()
  if (!config.database.uri.startsWith('mongo')) {
    return
  }
  const indexes = await ArticleModel.Model.collection.indexes()
  const foundIndex = indexes.find(idx => idx.name === INDEX_NAME)
  if (articlesExpire <= 0) {
    if (foundIndex) {
      await ArticleModel.Model.collection.dropIndex(INDEX_NAME)
    }
  } else {
    if (foundIndex && foundIndex.expireAfterSeconds !== 86400 * articlesExpire) {
      await ArticleModel.Model.collection.dropIndex(INDEX_NAME)
    }
    ArticleModel.schema.index({
      addedAt: 1
    }, {
      expires: articlesExpire * 86400
    })
    await ArticleModel.Model.ensureIndexes()
  }
}

module.exports = checkIndexes

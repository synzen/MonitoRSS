const config = require('../../config.js')
const { model, schema } = require('../../models/Article.js')
const INDEX_NAME = 'addedAt_1'

async function checkIndexes (articlesExpire) {
  if (!config.database.uri.startsWith('mongo')) {
    return
  }
  const indexes = await model.collection.indexes()
  const foundIndex = indexes.find(idx => idx.name === INDEX_NAME)
  if (articlesExpire <= 0) {
    if (foundIndex) {
      await model.collection.dropIndex(INDEX_NAME)
    }
  } else {
    if (foundIndex && foundIndex.expireAfterSeconds !== 86400 * articlesExpire) {
      await model.collection.dropIndex(INDEX_NAME)
    }
    schema.index({
      addedAt: 1
    }, {
      expires: articlesExpire * 86400
    })
    await model.ensureIndexes()
  }
}

module.exports = checkIndexes

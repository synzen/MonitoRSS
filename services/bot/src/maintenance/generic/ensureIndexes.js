/**
 * @param {import('mongoose').Model} Model
 * @param {number} daysUntilExpiration
 */
async function checkIndexes (Model, indexName, daysUntilExpiration) {
  const names = (await Model.db.db.listCollections().toArray())
    .map((collectionDetail) => collectionDetail.name)
  if (!names.includes(Model.collection.name)) {
    return
  }
  const indexes = await Model.collection.indexes()
  const foundIndex = indexes.find(idx => idx.name === indexName)
  if (daysUntilExpiration <= 0) {
    if (foundIndex) {
      await Model.collection.dropIndex(indexName)
    }
  } else {
    if (foundIndex && foundIndex.expireAfterSeconds !== 86400 * daysUntilExpiration) {
      await Model.collection.dropIndex(indexName)
    }
    Model.schema.index({
      addedAt: 1
    }, {
      expires: daysUntilExpiration * 86400
    })
    await Model.ensureIndexes()
  }
}

module.exports = checkIndexes

const ArticleModel = require('../../util/storage.js').models.Article
const UPDATE_SETTINGS = { overwrite: true, upsert: true, strict: true }

exports.findAll = (Model, callback) => Model.find({}, callback)

exports.selectIdsOrTitles = (Model, ids, titles, callback) => {
  Model.find({$or: [{id: { $in: ids }}, {title: { $in: titles }}]}, callback)
}

exports.update = (Model, article, callback) => {
  const toUpdate = { id: article._id, title: article.title }
  if (article.customComparisons) toUpdate.customComparisons = article.customComparisons
  Model.update({ id: toUpdate.id }, toUpdate, UPDATE_SETTINGS, callback)
}

exports.bulkInsert = (Model, articles, callback) => {
  if (articles.length === 0) return callback()
  const insert = []
  articles.forEach(article => insert.push(new Model({ id: article._id, title: article.title })))
  Model.collection.insert(insert, callback)
}

exports.dropCollection = (collection, callback) => {
  ArticleModel(collection).collection.drop(callback)
}

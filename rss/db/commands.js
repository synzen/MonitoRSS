const ArticleModel = require('../../util/storage.js').models.Article

exports.selectIdsOrTitles = (Model, ids, titles, callback) => {
  Model.find({$or: [{id: { $in: ids }}, {title: { $in: titles }}]}, callback)
}

exports.bulkInsert = (Model, articles, callback) => {
  if (articles.length === 0) return callback()
  const insert = []
  articles.forEach(article => {
    insert.push(new Model({
      id: article._id,
      title: article.title
    }))
  })
  Model.collection.insert(insert, callback)
}

exports.dropCollection = (collection, callback) => {
  console.log(collection)
  ArticleModel(collection).collection.drop(callback)
}

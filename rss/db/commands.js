const ArticleModel = require('../../util/storage.js').models.Article

// exports.selectId = (Model, articleId, callback) => {
//   Model.find({id: articleId}, callback)
// }

// exports.selectTitle = (Model, articleTitle, callback) => {
//   Model.find({title: articleTitle}, callback)
// }

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
  ArticleModel(collection).collection.drop(callback)
}

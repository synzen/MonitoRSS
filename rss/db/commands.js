const ArticleModel = require('../../util/storage.js').models.Article

exports.selectId = (model, articleId, callback) => {
  model.find({id: articleId}, callback)
}

exports.selectTitle = (model, articleTitle, callback) => {
  model.find({title: articleTitle}, callback)
}

exports.selectIdOrTitle = (model, id, title, callback) => {
  model.find({$or: [{id: id}, {title: title}]}, callback)
}

exports.bulkInsert = (model, articleInfos, callback) => {
  if (articleInfos.length === 0) return callback()
  model.collection.insert(articleInfos, callback)
}

exports.dropCollection = collection => {
  ArticleModel(collection).collection.drop((err, res) => {
    if (err) throw err
  })
}

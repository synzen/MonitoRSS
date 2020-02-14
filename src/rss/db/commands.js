const config = require('../../config.js')
const Article = require('../../models/Article.js').model

exports.findAll = async (feedURL, shardID, scheduleName) => {
  return Article.find({
    feedURL,
    shardID,
    scheduleName
  }).lean().exec()
}

exports.update = async (article) => {
  if (config.dev === true) {
    return
  }
  await Article.updateOne({
    _id: article._id
  }, {
    $set: article
  }).exec()
}

exports.bulkInsert = async (articles) => {
  if (articles.length === 0 || config.dev === true) {
    return
  }
  const insert = articles.map(article => new Article(article))
  return Article.insertMany(insert)
}

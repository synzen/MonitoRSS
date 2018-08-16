const UPDATE_SETTINGS = { overwrite: true, upsert: true, strict: true }
const mongoose = require('mongoose')

exports.findAll = async Model => {
  // Database
  if (mongoose.connection.name) return Model.find({}).lean().exec()

  // Memory
  return Model
}

exports.update = async (Model, article) => {
  const toUpdate = { id: article._id, title: article.title }
  if (article.customComparisons) toUpdate.customComparisons = article.customComparisons
  // Database
  if (mongoose.connection.name) return Model.update({ id: toUpdate.id }, toUpdate, UPDATE_SETTINGS).exec()

  // Memory
  for (var x = 0; x < Model.length; ++x) {
    const doc = Model[x]
    if (doc.id === article._id && article.customComparisons) doc.customComparisons = article.customComparisons
  }
}

exports.bulkInsert = async (Model, articles) => {
  if (articles.length === 0) return
  const insert = []
  // Database
  if (mongoose.connection.name) {
    articles.forEach(article => insert.push(new Model({ id: article._id, title: article.title })))
    return Model.collection.insert(insert)
  }

  // Memory
  for (var x = 0; x < articles.length; ++x) {
    const obj = { ...articles[x] }
    obj.id = obj._id
    delete obj._id
    Model.push(obj)
  }
}

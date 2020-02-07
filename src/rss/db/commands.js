const config = require('../../config.js')
const Article = require('../../models/Article.js').model
const UPDATE_SETTINGS = { upsert: true, strict: true }

exports.findAll = async (memoryCollection, feedURL, shardID, scheduleName) => {
  // Memory
  if (memoryCollection) {
    return memoryCollection
  }
  // Database
  return Article.find({
    feedURL,
    shardID,
    scheduleName
  }).lean().exec()
}

exports.update = async (memoryCollection, article, feedURL, shardID, scheduleName) => {
  if (config.dev === true) {
    return
  }
  if (memoryCollection) {
    // Memory
    for (let x = 0; x < memoryCollection.length; ++x) {
      const doc = memoryCollection[x]
      if (doc.id === article._id && article.customComparisons) {
        doc.customComparisons = article.customComparisons
      }
    }
  } else {
    // Database
    const toUpdate = {
      id: article._id,
      title: article.title
    }
    if (article.customComparisons) {
      toUpdate.customComparisons = article.customComparisons
    }
    const query = {
      id: toUpdate.id,
      feedURL,
      shardID,
      scheduleName
    }
    const doc = {
      $set: toUpdate
    }
    return Article.updateOne(query, doc, UPDATE_SETTINGS).exec()
  }
}

exports.bulkInsert = async (memoryCollection, articles, feedURL, shardID, scheduleName) => {
  if (articles.length === 0 || config.dev === true) {
    return
  }
  if (memoryCollection) {
    // Memory
    for (var x = 0; x < articles.length; ++x) {
      const obj = { ...articles[x] }
      obj.id = obj._id
      delete obj._id
      memoryCollection.push(obj)
    }
  } else {
    // Database
    const insert = articles.map(article => new Article({
      feedURL,
      shardID,
      scheduleName,
      id: article._id,
      title: article.title
    }))
    return Article.insertMany(insert)
  }
}

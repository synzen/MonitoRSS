const Article = require('../models/Article.js')
const PendingArticle = require('../structs/db/PendingArticle.js')

/**
 * @param {Object<string, any>} article
 * @param {string[]} properties
 * @param {string} useIDType
 * @param {Object<string, string|number>} meta
 */
function formatArticleForDatabase (article, properties, meta) {
  const propertyValues = {}
  for (const property of properties) {
    const value = article[property]
    if (value && typeof value === 'string') {
      propertyValues[property] = value
    }
  }
  return {
    id: article._id,
    feedURL: meta.feedURL,
    scheduleName: meta.scheduleName,
    properties: propertyValues
  }
}

/**
 * @param {Object<string, any>} article
 * @param {Object<string, any>} document
 * @param {string[]} properties - Feed properties
 */
function updatedDocumentForDatabase (article, document, properties) {
  const docProperties = document.properties
  let updated = false
  for (const property of properties) {
    const articleValue = article[property]
    if (!articleValue || typeof articleValue !== 'string') {
      continue
    }
    const docValue = docProperties[property]
    if (!docValue || docValue !== articleValue) {
      docProperties[property] = articleValue
      updated = true
    }
  }
  const pruned = module.exports.prunedDocumentForDatabase(document, properties)
  return updated || pruned
}

/**
 * @param {Object<string, any>} document
 * @param {string[]} properties
 */
function prunedDocumentForDatabase (document, properties) {
  let updated = false
  const docProperties = document.properties
  for (const property in docProperties) {
    if (!properties.includes(property)) {
      delete docProperties[property]
      updated = true
    }
  }
  return updated
}

/**
 * @param {Object<string, any>[]} articleList
 * @param {Object<string, any>[]} dbDocs
 * @param {string[]} properties
 */
function getInsertsAndUpdates (articleList, dbDocs, properties, meta) {
  if (!meta.feedURL) {
    throw new Error('Missing feedURL for database insert/update')
  }
  if (!meta.scheduleName) {
    throw new Error('Missing scheduleName for database insert/update')
  }
  const dbIDs = new Set(dbDocs.map(d => d.id))
  const toInsert = []
  const toUpdate = []
  // Insert
  for (const article of articleList) {
    const articleID = article._id
    if (!articleID) {
      continue
    }
    if (!dbIDs.has(articleID)) {
      toInsert.push(module.exports.formatArticleForDatabase(article, properties, meta))
    }
  }
  // Update
  for (const doc of dbDocs) {
    const article = articleList.find(a => a._id === doc.id)
    let updated = false
    if (article) {
      updated = module.exports.updatedDocumentForDatabase(article, doc, properties)
    } else {
      updated = module.exports.prunedDocumentForDatabase(doc, properties)
    }
    if (updated) {
      toUpdate.push(doc)
    }
  }
  return {
    toInsert,
    toUpdate
  }
}

/**
 * @param {Object<string, any>[]} documents
 * @param {Object<string, any>[]} memoryCollection
 */
async function insertDocuments (documents, memoryCollection) {
  if (documents.length === 0) {
    return
  }
  if (memoryCollection) {
    documents.forEach(doc => memoryCollection.push({ ...doc }))
  } else {
    const Model = Article.Model
    const insert = documents.map(article => new Model(article))
    await Model.insertMany(insert)
  }
}

/**
 * @param {Object<string, any>[]} documents
 * @param {Object<string, any>[]} memoryCollection
 */
async function updateDocuments (documents, memoryCollection) {
  if (documents.length === 0) {
    return
  }
  if (memoryCollection) {
    const updatedDocsByID = {}
    for (const doc of documents) {
      updatedDocsByID[doc.id] = doc
    }
    for (let i = 0; i < memoryCollection.length; ++i) {
      const id = memoryCollection[i].id
      const updatedDoc = updatedDocsByID[id]
      if (updatedDoc) {
        memoryCollection[i] = updatedDoc
      }
    }
  } else {
    const promises = documents.map(doc => Article.Model.updateOne({
      _id: doc._id
    }, {
      $set: doc
    }).exec())
    await Promise.all(promises)
  }
}

/**
 * @param {Object<string, any>[]} documents
 */
async function mapArticleDocumentsToURL (documents) {
  /** @type {Object<string, Object<string, any>[]>} */
  const map = {}
  for (const article of documents) {
    const feedURL = article.feedURL
    if (!map[feedURL]) {
      map[feedURL] = [article]
    } else {
      map[feedURL].push(article)
    }
  }
  return map
}

/**
 * @param {string} scheduleName
 * @param {Object<string, Object<string, any>[]>} memoryCollection
 */
async function getAllDocuments (scheduleName, memoryCollection) {
  if (memoryCollection) {
    return memoryCollection
  } else {
    const documents = await Article.Model.find({
      scheduleName
    }).lean().exec()
    return module.exports.mapArticleDocumentsToURL(documents)
  }
}

/**
 * Store a pending article for persistence if the bot shuts
 * down before articles could be sent after IPC
 *
 * @param {Object<string, any>} article
 * @returns {Object<string, any>} - JSON of pending article
 */
async function storePendingArticle (article) {
  const pending = new PendingArticle({
    article
  })
  return (await pending.save()).toJSON()
}

module.exports = {
  mapArticleDocumentsToURL,
  updatedDocumentForDatabase,
  prunedDocumentForDatabase,
  formatArticleForDatabase,
  getAllDocuments,
  getInsertsAndUpdates,
  insertDocuments,
  updateDocuments,
  storePendingArticle
}

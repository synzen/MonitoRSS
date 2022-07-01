const mongoose = require('mongoose')
const fs = require('fs')
const fsPromises = fs.promises
const path = require('path')
const createLogger = require('../../util/logger/create.js')
const getConfig = require('../../config.js').get
const log = createLogger('-')

/**
 * @typedef {import('mongoose').Model<import('mongoose').Document, {}>} MongooseModel
 */

class Base {
  /**
   * Object data
   * @param {MongooseModel|Object<string, any>} data
   */
  constructor (data = {}, _saved = false) {
    /**
     * this.data must be serialized to maintain
     * equal function between database and databaseless
     * @type {Object<string, any>}
     */
    this.data = data instanceof mongoose.Model ? JSON.parse(JSON.stringify(data.toJSON())) : data

    /**
     * Internal ID, usually MongoDB's ObjectId purely used
     * to distinguish between documents and to grab from
     * database during testing.
     * @type {string}
     */
    this._id = this.data._id

    /**
     * Whether this has been saved to the database already
     * @type {boolean}
     */
    this._saved = _saved

    /**
     * Only used for database methods
     * @type {MongooseModel}
     */
    this.document = data instanceof mongoose.Model ? data : null

    /**
     * The bot version this data model was created on
     * @type {string}
     */
    this.version = this.getField('version')

    /**
     * Time of entry
     * @type {string}
     */
    this.addedAt = this.getField('addedAt')

    // Run the get method and throw its associated error if unimplemented
    // eslint-disable-next-line no-void
    void this.constructor.Model
  }

  /**
   * Remove the internal version key when finding from database
   */
  static FIND_PROJECTION () {
    return { __v: 0 }
  }

  /**
   * Returns the Mongoose model specific to the class
   * @returns {MongooseModel}
   */
  static get Model () {
    throw new Error('Model static get method must be implemented by subclasses')
  }

  /**
   * Checks whether the app is databaseless
   * @returns {boolean}
   */
  static get isMongoDatabase () {
    const config = getConfig()
    return config.database.uri.startsWith('mongo')
  }

  /**
   * Get the folder paths of the intended fs location the data will
   * be written to.
   * @returns {string[]}
   */
  static getFolderPaths () {
    const config = getConfig()
    const folderPath = config.database.uri
    const subfolderPath = path.join(folderPath, this.Model.collection.collectionName)
    return [folderPath, subfolderPath]
  }

  /**
   * Helper function to return undefined for empty objects
   * @param {any} field - The field name
   * @private
   */
  static resolveObject (value) {
    if (!value || Object.keys(value).length === 0) {
      return undefined
    } else {
      return value
    }
  }

  /**
   * A function that validates data before saving it.
   * Used by extended classes.
   */
  async validate () {}

  /**
   * Resolves data acquisition based on whether the app is databaseless
   * @param {string} field - The field to get
   * @param {*} def - The default value if there is no value
   * @returns {*} - The field value
   */
  getField (field, def) {
    const value = this.data[field]
    return value === undefined || value === null ? def : value
  }

  /**
   * Convert class data into an object, but still maintains some data
   * structures such as Maps for compatibility with mongoose models.
   * @returns {Object<string, any>} - The object
   */
  toObject () {
    throw new Error('Method must be implemented by subclasses')
  }

  /**
   * Convert class data into a plain object with only primitive
   * values.
   * @returns {Object<string, any>} - The plain object
   */
  toJSON () {
    return this.toObject()
  }

  /**
   * Get a document
   * @param {string} id - Guild ID
   * @returns {Promise<Base|null>}
   */
  static async get (id) {
    if (!id) {
      throw new Error('Undefined id')
    }
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }

    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.Model

    // Mongo
    if (this.isMongoDatabase) {
      const doc = await DatabaseModel.findById(id).exec()
      return doc ? new this(doc, true) : null
    }

    // Databaseless
    const folderPaths = this.getFolderPaths()
    const folderPath = folderPaths[folderPaths.length - 1]
    const filePath = path.join(folderPath, `${id}.json`)
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const readContent = fs.readFileSync(filePath)
      return new this(JSON.parse(readContent), true)
    } catch (err) {
      log.warn(err, `Could not parse ${DatabaseModel.collection.collectionName} JSON from file ${id}`)
      return null
    }
  }

  /**
   * Get by a field's value
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Promise<Base|null>}
   */
  static async getBy (field, value) {
    return this.getByQuery({ [field]: value })
  }

  /**
   * Get one with a custom query
   * @param {Object<string, any>} query - MongoDB-format query
   * @returns {Promise<Base>}
   */
  static async getByQuery (query) {
    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.Model

    // Database
    if (this.isMongoDatabase) {
      const doc = await DatabaseModel.findOne(query, this.FIND_PROJECTION).exec()
      return doc ? new this(doc, true) : null
    }

    const results = await this.getManyByQuery(query)
    return results.length > 0 ? new this(results[0], true) : null
  }

  /**
   * Get many by a field's value
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Promise<Base[]>}
   */
  static async getManyBy (field, value) {
    return this.getManyByQuery({ [field]: value })
  }

  /**
   * Get many with a custom query
   * @param {Object<string, any>} query - MongoDB-format query
   * @returns {Promise<Base[]>}
   */
  static async getManyByQuery (query) {
    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.Model

    // Database
    if (this.isMongoDatabase) {
      const docs = await DatabaseModel.find(query, this.FIND_PROJECTION).exec()
      return docs.map(doc => new this(doc, true))
    }

    // Databaseless - very slow
    const folderPaths = this.getFolderPaths()
    const folderPath = folderPaths[folderPaths.length - 1]
    if (!fs.existsSync(folderPath)) {
      return []
    }

    const fileNames = await fsPromises.readdir(folderPath)
    const resolved = fileNames.map(name => fs.readFileSync(path.join(folderPath, name)))
    const jsons = resolved.map((contents, index) => {
      try {
        return JSON.parse(contents)
      } catch (err) {
        log.warn(err, `Failed to parse json at ${folderPath} ${fileNames[index]}`)
      }
    })
    return jsons
      .filter(item => {
        if (!item) {
          return false
        }
        let allTrue = true
        for (const key in query) {
          allTrue = allTrue && item[key] === query[key]
        }
        return allTrue
      })
      .map(item => new this(item, true))
  }

  /**
   * Get multiple documents
   * @param {string[]} ids - Array of guild IDs
   * @returns {Promise<Base[]>}
   */
  static async getMany (ids) {
    return Promise.all(ids.map(id => this.get(id)))
  }

  /**
   * Prevent the find method from getting too many results in bulk.
   * Only supported for MongoDB
   *
   * @param {number} npp Number (of docs) per page to fetch per query/page
   */
  static async getAllByPagination (npp = 5000) {
    if (!this.isMongoDatabase) {
      // Pagination is not supported for databaseless
      return this.getAll()
    }
    // https://docs.mongodb.com/manual/reference/method/cursor.skip/#using-range-queries
    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.Model
    async function getPage (startId, numberPerPage) {
      const results = await DatabaseModel.find({
        _id: {
          $lt: new mongoose.Types.ObjectId(startId)
        }
      }).sort({
        _id: -1
      }).limit(numberPerPage).exec()
      // No more results since results has less than the limit per page
      if (results.length < numberPerPage) {
        return results
      }
      // Get the last ID of the last document as the start
      const lastId = results[results.length - 1]._id
      const nextResults = await getPage(lastId, numberPerPage)
      results.push(...nextResults)
      return results
    }
    const largestIdDoc = (await DatabaseModel.find().sort({
      _id: -1
    }).limit(1).exec())[0]
    if (!largestIdDoc) {
      return []
    }
    const documents = await getPage(largestIdDoc._id, npp)
    const documentsLength = documents.length
    /**
     * Add doc with the largest ID since getPage does not
     * include the doc with the largest id ($lt is less than)
     *
     * Also use a for loop with var instead of let since this
     * function is optimized for performance
     */
    const converted = [new this(largestIdDoc, true)]
    for (var i = 0; i < documentsLength; ++i) {
      converted.push(new this(documents[i], true))
    }
    return converted
  }

  /**
   * Get all documents
   * @returns {Promise<Base[]>}
   */
  static async getAll () {
    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.Model

    // Mongo
    if (this.isMongoDatabase) {
      const documents = await DatabaseModel.find({}, this.FIND_PROJECTION).exec()
      return documents.map(doc => new this(doc, true))
    }

    // Databaseless
    const folderPaths = this.getFolderPaths()
    const fullPath = folderPaths[folderPaths.length - 1]
    if (!fs.existsSync(fullPath)) {
      return []
    }
    const fileReads = fs.readdirSync(fullPath)
      .filter(id => /\.json$/.test(id))
      .map(fileName => this.get(fileName.replace(/\.json/i, '')))

    return Promise.all(fileReads)
  }

  /**
   * Deletes all from the database
   */
  static async deleteAll () {
    // Mongo
    if (this.isMongoDatabase) {
      await this.Model.deleteMany({}).exec()
      return
    }

    // Databaseless
    const folderPaths = this.getFolderPaths()
    if (fs.existsSync(folderPaths[1])) {
      const files = await fsPromises.readdir(folderPaths[1])
      await Promise.all(files.map(name => fsPromises.unlink(path.join(folderPaths[1], name))))
      await fsPromises.rmdir(folderPaths[1])
    }
  }

  /**
   * Deletes this from either the database from the file system
   * depending on whether the app is databaseless.
   */
  async delete () {
    if (!this._saved) {
      throw new Error('Data has not been saved')
    }

    // Mongo
    if (this.constructor.isMongoDatabase) {
      await this.document.remove()
      return
    }

    const Model = this.constructor.Model

    // Databaseless
    const paths = this.constructor.getFolderPaths()
    const folderPath = paths[paths.length - 1]
    const filePath = path.join(folderPath, `${this._id}.json`)
    if (!fs.existsSync(filePath)) {
      log.warn(`Unable to delete ${Model.collection.collectionName} ${this._id} at ${filePath} since its nonexistent`)
    } else {
      fs.unlinkSync(filePath)
    }
  }

  /**
   * Save the data to either the database or a file depending on whether the
   * app is databaseless.
   * @returns {Promise<Base>} - This instance
   */
  async save () {
    await this.validate()
    if (this.constructor.isMongoDatabase) {
      return this.saveToDatabase()
    } else {
      return this.saveToFile()
    }
  }

  /**
   * Save the data to the database
   * @returns {Promise<Base>}
   */
  async saveToDatabase () {
    const toSave = this.toObject()

    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.constructor.Model

    if (!this._saved) {
      // Delete all undefined keys
      for (const key in toSave) {
        if (toSave[key] === undefined) {
          delete toSave[key]
        }
      }
      const model = new DatabaseModel(toSave)
      const document = await model.save()

      this._saved = true
      this._id = document.id
      this.document = document
      this.data = JSON.parse(JSON.stringify(document.toJSON()))
    } else {
      for (const key in toSave) {
        const value = toSave[key]
        // Map values must be individually set and deleted
        if (value instanceof Map) {
          if (!this.document[key]) {
            this.document.set(key, new Map())
          }
          const docMap = this.document[key]
          // First remove all unknown keys
          docMap.forEach((v, key) => {
            if (!value.has(key)) {
              docMap.delete(key)
            }
          })
          // Then set the new values
          value.forEach((value, mapKey) => docMap.set(mapKey, value))
        } else {
          this.document.set(key, toSave[key])
        }
      }
      const saved = await this.document.save()
      this.data = JSON.parse(JSON.stringify(saved.toJSON()))

      // Update class data
      for (const key in toSave) {
        this[key] = this.data[key]
      }
    }

    return this
  }

  /**
   * Saves the data to a file
   * @returns {Promise<Base>}
   */
  async saveToFile () {
    const toSave = this.toJSON()

    for (const key in toSave) {
      if (toSave[key] === undefined) {
        delete toSave[key]
      }
    }

    const folderPaths = this.constructor.getFolderPaths()
    for (const p of folderPaths) {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p)
      }
    }
    const folderPath = folderPaths[folderPaths.length - 1]
    if (!this._saved) {
      let useId = toSave._id
      if (!useId) {
        useId = new mongoose.Types.ObjectId().toHexString()
        toSave._id = useId
      }
      const serialized = JSON.stringify(toSave, null, 2)
      await fs.writeFileSync(path.join(folderPath, `${useId}.json`), serialized)
      this._id = useId
      this._saved = true
    } else {
      const serialized = JSON.stringify(toSave, null, 2)
      await fs.writeFileSync(path.join(folderPath, `${this._id}.json`), serialized)
    }
    return this
  }
}

module.exports = Base

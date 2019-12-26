const mongoose = require('mongoose')
const config = require('../../config.js')
const fs = require('fs')
const fsPromises = fs.promises
const path = require('path')
const log = require('../../util/logger.js')

/**
 * @typedef {import('mongoose').Model<import('mongoose').Document, {}>} MongooseModel
 */

class Base {
  /**
   * Object data
   * @param {MongooseModel|Object<string, any>} data
   */
  constructor (data = {}) {
    /**
     * this.data must be serialized to maintain equal function
     * between database and databaseless
     * @type {Object<string, any>}
     */
    this.data = data instanceof mongoose.Model ? JSON.parse(JSON.stringify(data.toObject())) : data

    /**
     * Only used for database methods
     * @type {MongooseModel}
     */
    this.document = data instanceof mongoose.Model ? data : null

    /**
     * Internal ID, usually MongoDB's ObjectId
     * @type {string}
     */
    this._id = this.getField('_id')

    /**
     * The bot version this data model was created on
     * @type {string}
     */
    this.version = this.getField('version')

    // Run the get method and throw its associated error if unimplemented
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
    return config.database.uri.startsWith('mongo')
  }

  /**
   * Get the folder paths of the intended fs location the data will
   * be written to.
   * @returns {string[]}
   */
  static getFolderPaths () {
    const folderPath = config.database.uri
    const subfolderPath = path.join(folderPath, this.Model.collection.collectionName)
    return [ folderPath, subfolderPath ]
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
   * Getter for this._id
   * @returns {string}
   */
  get id () {
    return this._id
  }

  /**
   * Check whether the data has been written to the database or file
   * @returns {boolean}
   */
  isSaved () {
    if (this.constructor.isMongoDatabase) {
      return !!this._id && !!this.document
    } else {
      return !!this._id
    }
  }

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
   * Convert data into a plain object
   * @returns {Object<string, any>} - The plain object
   */
  toObject () {
    throw new Error('Method must be implemented by subclasses')
  }

  /**
   * Get a document
   * @param {string} id - Guild ID
   * @returns {Base|null}
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
      return doc ? new this(doc) : null
    }

    // Databaseless
    const filePath = path.join(config.database.uri, `${id}.json`)
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const readContent = fs.readFileSync(filePath)
      return new this(JSON.parse(readContent))
    } catch (err) {
      log.general.warning(`Could not parse ${DatabaseModel.collection.collectionName} JSON from file ${id}`, err)
      return null
    }
  }

  static async getBy (field, value) {
    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.Model

    // Database
    if (this.isMongoDatabase) {
      const query = {
        [field]: value
      }
      const doc = await DatabaseModel.findOne(query, this.FIND_PROJECTION).exec()
      return doc ? new this(doc) : null
    }

    // Databaseless - very slow
    const folderPaths = this.getFolderPaths()
    const folderPath = folderPaths[folderPaths.length - 1]
    if (!fs.existsSync(folderPath)) {
      return null
    }

    const fileNames = await fsPromises.readdir(folderPath)
    const promises = fileNames.map(name => fsPromises.readFile(path.join(folderPath, name)))
    const resolved = await Promise.all(promises)
    const jsons = resolved.map((contents, index) => {
      try {
        return JSON.parse(contents)
      } catch (err) {
        log.general.error(`Failed to parse json at ${folderPath} ${fileNames[index]}`, err)
      }
    })
    return jsons.filter(item => item).find(json => json[field] === value) || null
  }

  /**
   * Get multiple documents
   * @param {string[]} ids - Array of guild IDs
   * @returns {Base[]}
   */
  static async getMany (ids) {
    return Promise.all(ids.map(id => this.get(id)))
  }

  /**
   * Get all documents
   * @returns {Base[]}
   */
  static async getAll () {
    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.Model

    // Mongo
    if (this.isMongoDatabase) {
      const documents = await DatabaseModel.find({}, this.FIND_PROJECTION).exec()
      return documents.map(doc => new this(doc))
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
   * Deletes this from either the database from the file system
   * depending on whether the app is databaseless.
   */
  async delete () {
    if (!this.isSaved()) {
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
      log.general.warning(`Unable to delete ${Model.collection.collectionName} ${this._id} at ${filePath} since its nonexistent`)
    } else {
      fs.unlinkSync(filePath)
    }
  }

  /**
   * Save the data to either the database or a file depending on whether the
   * app is databaseless.
   * @returns {Base} - This instance
   */
  async save () {
    if (this.constructor.isMongoDatabase) {
      return this.saveToDatabase()
    } else {
      return this.saveToFile()
    }
  }

  /**
   * Save the data to the database
   * @returns {Base}
   */
  async saveToDatabase () {
    const toSave = this.toObject()

    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.constructor.Model

    if (!this.isSaved()) {
      // Delete all null keys
      for (const key in toSave) {
        if (toSave[key] === undefined) {
          delete toSave[key]
        }
      }
      const model = new DatabaseModel(toSave)
      const document = await model.save()

      this.document = document

      // doc.id converts the ObjectId to string
      this._id = document.id
    } else {
      for (const key in toSave) {
        this.document.set(key, toSave[key])
      }
      const saved = await this.document.save()
      this.data = JSON.parse(JSON.stringify(saved.toObject()))

      // Update class data
      for (const key in this.data) {
        this[key] = this.data[key]
      }
    }
    return this
  }

  /**
   * Saves the data to a file
   * @returns {Base}
   */
  async saveToFile () {
    const toSave = this.toObject()

    for (const key in toSave) {
      if (toSave[key] === undefined) {
        delete toSave[key]
      }
    }
    const serialized = JSON.stringify(toSave, null, 2)

    const folderPaths = this.constructor.getFolderPaths()
    for (const p of folderPaths) {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p)
      }
    }
    const folderPath = folderPaths[folderPaths.length - 1]
    if (!this.isSaved()) {
      const newId = new mongoose.Types.ObjectId().toHexString()
      await fs.writeFileSync(path.join(folderPath, `${newId}.json`), serialized)
      this._id = newId
    } else {
      await fs.writeFileSync(path.join(folderPath, `${this._id}.json`), serialized)
    }
    return this
  }
}

module.exports = Base

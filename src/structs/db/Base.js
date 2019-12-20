const mongoose = require('mongoose')
const config = require('../../config.js')
const fs = require('fs')
const path = require('path')
const log = require('../../util/logger.js')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'))).version

/**
 * @typedef {import('mongoose').Model} MongooseModel
 */

class Base {
  /**
   * Object data
   * @param {Object<string, any>} data
   */
  constructor (data) {
    this.data = data

    /**
     * The bot version this data model was created on
     * @type {string}
     */
    this.version = packageVersion

    // Run the get method and throw its associated error if unimplemented
    void this.constructor.Model
  }

  static FIND_PROJECTION () {
    return { _id: 0, __v: 0 }
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

  static getFolderPaths () {
    const folderPath = config.database.uri
    const subfolderPath = path.join(folderPath, this.Model.collection.collectionName)
    return [ folderPath, subfolderPath ]
  }

  /**
   * Resolves data acquisition based on whether the app is databaseless
   * @param {string} field - The field to get
   * @param {*} def - The default value if there is no value
   * @returns {*} - The field value
   */
  getField (field, def) {
    const value = this.data instanceof mongoose.Model
      ? this.data.get(field) : this.data[field]
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

    /**
     * @type {MongooseModel}
     */
    const DatabaseModel = this.Model

    // Mongo
    if (this.isMongoDatabase) {
      const query = { id }
      const model = await DatabaseModel.findOne(query).exec()
      return new this(model)
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
   * Deletes a document from either the database from the file system
   * depending on whether the app is databaseless.
   */
  static async delete (id) {
    if (!id) {
      throw new Error('id field is undefined')
    }

    // Mongo
    if (this.isMongoDatabase) {
      return this.Model.deleteOne({ id })
    }

    // Databaseless
    const paths = this.getFolderPaths()
    const fullPath = paths[paths.length - 1]
    if (!fs.existsSync(fullPath)) {
      log.general.warning(`Unable to delete ${this.Model.collection.collectionName} ${id} at ${fullPath} since its nonexistent`)
    } else {
      fs.unlinkSync(path.join(fullPath, `${id}.json`))
    }
  }

  /**
   * Save the data to either the database or a file depending on whether the
   * app is databaseless.
   * @returns {Base} - This instance
   */
  async save () {
    if (this.data instanceof mongoose.Model) {
      throw new Error('Data cannot be saved when instantiated by a Model (use update instead)')
    }
    if (!this.id) {
      throw new Error('id field is not populated')
    }

    /**
     * @type {import('mongoose').Model}
     */
    const DatabaseModel = this.constructor.Model

    // Otherwise it's a plain object
    const toSave = this.toObject()
    if (this.constructor.isMongoDatabase) {
      const query = {
        id: this.id
      }
      const options = {
        ...this.constructor.FIND_PROJECTION,
        upsert: true,
        new: true
      }
      const document = await DatabaseModel.findOneAndUpdate(query, toSave, options).exec()
      this.data = document
    } else {
      const folderPaths = this.constructor.getFolderPaths()
      for (const p of folderPaths) {
        if (!fs.existsSync(p)) {
          fs.mkdirSync(p)
        }
      }
      const fullPath = folderPaths[folderPaths.length - 1]
      await fs.writeFileSync(path.join(fullPath, `${this.id}.json`), JSON.stringify(toSave, null, 2))
    }
    return this
  }
}

module.exports = Base

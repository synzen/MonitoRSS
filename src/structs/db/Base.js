const mongoose = require('mongoose')
const config = require('../../config.js')
const fs = require('fs')
const path = require('path')
const log = require('../../util/logger.js')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'))).version

/**
 * @typedef {import('mongoose').Model<import('mongoose').Document, {}>} MongooseModel
 */

class Base {
  /**
   * Object data
   * @param {MongooseModel|Object<string, any>} data
   */
  constructor (data = {}) {
    this.data = data

    /**
     * MongoDB's generated ID if instantiated with a model
     * @type {string}
     */
    this._id = data._id

    /**
     * The bot version this data model was created on
     * @type {string}
     */
    this.version = packageVersion

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
   * Check whether the data has been written to the database or file
   * @returns {boolean}
   */
  isSaved () {
    if (this.constructor.isMongoDatabase) {
      return !!this._id && this.data instanceof mongoose.Model
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

    const options = {
      ...this.constructor.FIND_PROJECTION,
      upsert: true,
      new: true
    }

    let document
    if (!this.isSaved()) {
      const model = new DatabaseModel(toSave)
      document = await model.save()
    } else {
      document = await DatabaseModel.findByIdAndUpdate(this._id, toSave, options).exec()
    }
    this.data = document
    this._id = document._id
    return this
  }

  /**
   * Saves the data to a file
   * @returns {Base}
   */
  async saveToFile () {
    const toSave = JSON.stringify(this.toObject(), null, 2)
    const folderPaths = this.constructor.getFolderPaths()
    for (const p of folderPaths) {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p)
      }
    }
    const folderPath = folderPaths[folderPaths.length - 1]
    if (!this.isSaved()) {
      const newId = new mongoose.Types.ObjectId().toHexString()
      await fs.writeFileSync(path.join(folderPath, `${newId}.json`), toSave)
      this._id = newId
    } else {
      await fs.writeFileSync(path.join(folderPath, `${this._id}.json`), toSave)
    }
    return this
  }
}

module.exports = Base

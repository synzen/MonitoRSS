const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const pascalToSnake = require('../util/pascalToSnake.js')

/**
 * Sets up all the mongoose models
 *
 * @param {import('mongoose').Connection} connection
 */
async function setupModels (connection) {
  if (!connection) {
    connection = mongoose
  }
  const modelsPath = path.join(__dirname, '..', 'models')
  const contents = await fs.promises.readdir(modelsPath, 'utf-8')
  const files = contents.filter(name => name.endsWith('.js'))
  for (const name of files) {
    const required = require(`../models/${name}`)
    const modelName = pascalToSnake(name).replace('.js', '')
    if (required.setupHooks) {
      required.setupHooks(connection)
    }
    required.Model = connection.model(modelName, required.schema)
  }
}

module.exports = setupModels

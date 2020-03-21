const fs = require('fs')
const configuration = require('../src/config.js')
const mongoose = require('mongoose')
const v6 = require('./updates/6.0.0.js')

const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']

function readFileData (config = {}) {
  const buffers = {}
  if (Object.keys(config).length > 0) {
    for (let x = 0; x < BUFFER_CONFIGS.length; ++x) {
      const name = BUFFER_CONFIGS[x]
      if (config[name]) {
        buffers[name] = fs.readFileSync(config[name])
      }
    }
  }
  return buffers
}

async function dumpCollections () {
  const toCheck = ['profiles', 'feeds', 'subscribers', 'filtered_formats', 'fail_records', 'supporters']
  const collections = (await mongoose.connection.db
    .listCollections().toArray()).map(c => c.name)
  for (const name of toCheck) {
    if (collections.includes(name)) {
      console.log(`Dropping ${name} collection`)
      await mongoose.connection.collection(name).drop()
    }
  }
}

/**
 * @param {string} uri
 * @param {Object<string, any>} options
 */
async function run (config) {
  const uri = config.database.uri
  const options = config.database.connection
  configuration.set(config)
  if (uri.startsWith('mongo')) {
    const parsedOptions = readFileData(options)
    await mongoose.connect(uri, {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ...parsedOptions
    })
    await dumpCollections()
    const failures = await v6.run(false, uri)
    await mongoose.connection.close()
    return failures
  } else {
    return v6.run(true, uri)
  }
}

module.exports = run

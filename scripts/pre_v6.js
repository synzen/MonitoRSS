const config = require('../src/config.js')
const mongoose = require('mongoose')
const connectDb = require('../src/util/connectDatabase.js')
const v6 = require('./updates/6.0.0.js')

if (config.database.uri.startsWith('mongo')) {
  connectDb(true).then(async () => {
    try {
      const toCheck = ['profiles', 'feeds', 'subscribers', 'filtered_formats', 'fail_records', 'supporters']
      const collections = (await mongoose.connection.db
        .listCollections().toArray()).map(c => c.name)
      for (const name of toCheck) {
        if (collections.includes(name)) {
          console.log(`Dropping ${name} collection`)
          await mongoose.connection.collection(name).drop()
        }
      }
      await v6.run()
    } catch (err) {
      throw err
    }
  })
} else {
  v6.run(true).catch(console.error)
}

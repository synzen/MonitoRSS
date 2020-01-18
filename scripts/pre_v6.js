const mongoose = require('mongoose')
const connectDb = require('../src/rss/db/connect.js')
const v6 = require('./updates/6.0.0.js')

connectDb(true).then(async () => {
  try {
    const toCheck = ['profiles', 'feeds', 'subscribers', 'formats', 'fail_counters']
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

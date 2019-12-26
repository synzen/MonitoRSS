const mongoose = require('mongoose')
const FilterBase = require('../../models/FilterBase.js').model
const dbName = 'test_int_middleware_filterbase'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::models/middleware/FilterBase', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  it('deletes empty arrays', async function () {
    const toCreate = {
      filters: {
        title: ['hello', 'world'],
        description: ['doii']
      }
    }
    const base = new FilterBase(toCreate)
    const saved = await base.save()
    saved.filters.get('description').shift()
    await saved.save()
    expect(saved.filters.get('description')).toBeUndefined()
    saved.filters.set('title', [])
    await saved.save()
    expect(saved.filters.get('title')).toBeUndefined()

  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})

process.env.TEST_ENV = true
const mongoose = require('mongoose')
const FoobarFiltersModel = require('./__mocks__/FoobarFilters.js')
const FoobarFilters = require('./__mocks__/FoobarFiltersClass.js')
const dbName = 'test_int_filterbase'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js', () => ({
  get: () => ({
    database: {
      uri: 'mongodb://'
    }
  })
}))

describe('Int::structs/db/FilterBase Database', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
  })
  beforeEach(async function () {
    await mongoose.connection.db.dropDatabase()
  })
  describe('constructor', function () {
    it('initializes filters as an empty object', function () {
      const foobar = new FoobarFilters()
      expect(foobar.filters).toEqual({})
    })
  })
  describe('toObject', function () {
    it('adds filters to the object as a map', function () {
      const filters = {
        be: [1, 2, 3],
        good: ['a', 'b']
      }
      const initialize = {
        foo: 'abc',
        filters
      }
      const foobar = new FoobarFilters(initialize)
      const returned = foobar.toObject()
      expect(returned.foo).toEqual(initialize.foo)
      expect(returned.filters).toBeInstanceOf(Map)
      returned.filters.forEach((value, key) => {
        expect(value).toEqual(filters[key])
      })
    })
  })
  it('saves filters correctly', async function () {
    const filters = {
      title: ['abc'],
      description: ['1', '2', '3']
    }
    const foobar = new FoobarFilters({ filters })
    const saved = await foobar.save()
    const found = await FoobarFiltersModel.findById(saved._id).lean().exec()
    expect(found.filters).toEqual(filters)
    foobar.filters.title = []
    foobar.filters.description.splice(1, 1)
    await foobar.save()
    const foundNew = await FoobarFiltersModel.findById(saved._id).lean().exec()
    expect(foundNew.filters).toEqual({
      description: ['1', '3']
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})

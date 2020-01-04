process.env.TEST_ENV = true
const mongoose = require('mongoose')
const config = require('../../../config.js')
const AssignedSchedule = require('../../../structs/db/AssignedSchedule.js')
const Article = require('../../../models/Article.js')
const pruneCollections = require('../../../util/maintenance/pruneCollections.js')

jest.mock('mongoose')
jest.mock('../../../config.json')
jest.mock('../../../structs/db/AssignedSchedule.js')
jest.mock('../../../models/Article.js')

describe('utils/maintenance/pruneCollections', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  it('returns -1 if not mongo database or config clean is false', async function () {
    AssignedSchedule.isMongoDatabase = false
    config.database.clean = true
    await expect(pruneCollections()).resolves.toEqual(-1)
    AssignedSchedule.isMongoDatabase = true
    config.database.clean = false
    await expect(pruneCollections()).resolves.toEqual(-1)
    config.database.clean = true
  })
  describe('is mongo database and database clean', function () {
    beforeEach(function () {
      config.database.clean = true
      AssignedSchedule.isMongoDatabase = true
      mongoose.connection = {
        db: {
          dropCollection: jest.fn(),
          listCollections: jest.fn()
        }
      }
    })
    it('does not drop relevant collections', async function () {
      // Each AssignedSchedule has its own collection
      AssignedSchedule.getAll.mockResolvedValue([1, 1, 1, 1, 1])
      const collectionsInUse = ['1a', '2a', '3a', '4d', '5g']
      for (const n of collectionsInUse) {
        Article.getCollectionID.mockReturnValueOnce(n)
      }
      mongoose.connection.db.listCollections.mockReturnValue({
        toArray: () => collectionsInUse.map(name => ({ name }))
      })
      await pruneCollections()
      for (const n of collectionsInUse) {
        expect(mongoose.connection.db.dropCollection)
          .not.toHaveBeenCalledWith(n)
      }
    })
    it('drops irrelevant collections', async function () {
      AssignedSchedule.getAll.mockResolvedValue([1, 1])
      const collectionsInUse = ['1a', '2a']
      const unusedCollections = ['55gfh', '66ewstg', '10a']
      for (const n of collectionsInUse) {
        Article.getCollectionID.mockReturnValueOnce(n)
      }
      mongoose.connection.db.listCollections.mockReturnValue({
        toArray: () => [ ...collectionsInUse, ...unusedCollections ]
          .map(name => ({ name }))
      })
      await pruneCollections()
      for (const n of unusedCollections) {
        expect(mongoose.connection.db.dropCollection)
          .toHaveBeenCalledWith(n)
      }
    })
  })
})

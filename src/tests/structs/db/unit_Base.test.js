process.env.TEST_ENV = true
const mongoose = require('mongoose')
const Base = require('../../../structs/db/Base.js')
const config = require('../../../config.js')
const path = require('path')
const fs = require('fs')

jest.mock('mongoose')
jest.mock('../../../config.js')

class BasicBase extends Base {
  static get Model () {}
}

const createMockModel = () => ({
  findOne: jest.fn(() => ({ exec: async () => Promise.resolve() })),
  findOneAndUpdate: jest.fn(() => ({ exec: async () => Promise.resolve() })),
  find: jest.fn(() => ({ exec: async () => Promise.resolve() })),
  deleteOne: jest.fn(() => ({ exec: async () => Promise.resolve() })),
  collection: {
    collectionName: 123
  }
})

describe('Unit::Base', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('throws an error when Model is not implemented', function () {
      const expectedError = new Error('Model static get method must be implemented by subclasses')
      expect(() => new Base()).toThrowError(expectedError)
    })
    it(`doesn't throw an error when Model is implemented in subclass`, function () {
      jest.spyOn(Base, 'Model', 'get').mockImplementationOnce(() => {})
      expect(() => new Base()).not.toThrowError()
    })
    it('sets this.data', function () {
      const data = 'wr4y3e5tuj'
      const base = new BasicBase(data)
      expect(base.data).toEqual(data)

    })
  })
  describe('static get isMongoDatabase', function () {
    it('calls startsWith', function () {
      const original = config.database.uri
      config.database.uri = { startsWith: jest.fn() }
      void BasicBase.isMongoDatabase
      expect(config.database.uri.startsWith).toHaveBeenCalled()
      config.database.uri = original
    })
  })
  describe('static getFolderPaths', function () {
    it('returns correctly', function () {
      const original = config.database.uri
      config.database.uri = 'abc'
      const collectionName = 'def'
      const spy = jest.spyOn(BasicBase, 'Model', 'get').mockReturnValue({
        collection: {
          collectionName
        }
      })
      const result = BasicBase.getFolderPaths()
      expect(result).toEqual([
        config.database.uri,
        `${config.database.uri}\\${collectionName}`
      ])
      spy.mockRestore()
      config.database.uri = original
    })
  })
  describe('static getField', function () {
    it('returns the data from mongoose model get', function () {
      const base = new BasicBase()
      base.data = new mongoose.Model()
      const field = 'w34rey5th'
      const value = 'q w2tr4gyij'
      base.data.get.mockReturnValueOnce(value)
      const returnValue = base.getField(field)
      expect(base.data.get).toHaveBeenCalledTimes(1)
      expect(base.data.get.mock.calls[0]).toEqual([field])
      expect(returnValue).toEqual(value)
    })
    it('returns the data from plain object', function () {
      const base = new BasicBase()
      const field = 'we4ryhdt'
      const value = 'sw34rye5htd'
      base.data = { [field]: value }
      const returnValue = base.getField(field)
      expect(returnValue).toEqual(value)
    })
  })
  describe('toObject', function () {
    it('throws an error when unimplemented', function () {
      const base = new BasicBase()
      expect(() => base.toObject()).toThrowError(new Error('Method must be implemented by subclasses'))
    })
    it(`doesn't throw an error when implemented`, function () {
      const base = new BasicBase()
      jest.spyOn(BasicBase.prototype, 'toObject').mockImplementation(() => {})
      expect(() => base.toObject()).not.toThrowError()
    })
  })
  describe('get', function () {
    it('throws an error for undefined id', function () {
      return expect(BasicBase.get()).rejects.toThrowError(new Error('Undefined id'))
    })
    describe('from database', function () {
      let mockModel = createMockModel()
      beforeEach(function () {
        mockModel = createMockModel()
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(true)
        jest.spyOn(BasicBase, 'Model', 'get').mockReturnValueOnce(mockModel)
      })
      it(`uses findOne for database`, async function () {
        const id = '3w4e5rytu'
        await BasicBase.get(id)
        expect(mockModel.findOne).toHaveBeenCalledWith({ id })
      })
      it('returns a new Basic Base for database', async function () {
        const id = '12qw34r'
        const execReturnValue = 'w24r3'
        mockModel.findOne.mockReturnValue(({ exec: () => Promise.resolve(execReturnValue) }))
        const result = await BasicBase.get(id)
        expect(result).toBeInstanceOf(BasicBase)
        expect(result.data).toEqual(execReturnValue)
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(fs, 'readFileSync').mockReturnValue()
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(false)
      })
      it('returns null if path does not exist', async function () {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false)
        const returnValue = await BasicBase.get(1)
        expect(returnValue).toBeNull()
      })
      it('returns the a new instance correctly', async function () {
        const jsonString = '{"foo": "bar"}'
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        jest.spyOn(fs, 'readFileSync').mockReturnValue(jsonString)
        const returnValue = await BasicBase.get(1)
        expect(returnValue).toBeInstanceOf(BasicBase)
        expect(returnValue.data).toEqual({ foo: 'bar' })
      })
      it('returns null when JSON parse fails', async function () {
        const jsonString = '{"foo": bar ;}'
        jest.spyOn(BasicBase, 'Model', 'get').mockReturnValue(createMockModel())
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        jest.spyOn(fs, 'readFileSync').mockReturnValue(jsonString)
        const returnValue = await BasicBase.get(1)
        expect(returnValue).toBeNull()
      })
    })
  })
  describe('getMany', function () {
    it('returns correctly', async function () {
      const ids = [1, 2, 3, 4, 5]
      jest.spyOn(BasicBase, 'get').mockReturnValue(1)
      const returnValue = await BasicBase.getMany(ids)
      const expected = ids.map(() => 1)
      expect(returnValue).toEqual(expected)
    })
  })
  describe('getAll', function () {
    describe('from database', function () {
      let mockModel = createMockModel()
      beforeEach(function () {
        mockModel = createMockModel()
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(true)
        jest.spyOn(BasicBase, 'Model', 'get').mockReturnValueOnce(mockModel)
      })
      it('calls find with {}', async function () {
        mockModel.find.mockReturnValue(({ exec: () => Promise.resolve([]) }))
        await BasicBase.getAll()
        expect(mockModel.find).toHaveBeenCalledWith({}, BasicBase.FIND_PROJECTION)
      })
      it('returns correctly', async function () {
        const documents = [1, 2, 3, 4, 5]
        mockModel.find.mockReturnValue(({ exec: () => Promise.resolve(documents) }))
        const returnValues = await BasicBase.getAll()
        expect(returnValues).toBeInstanceOf(Array)
        for (let i = 0; i < documents.length; ++i) {
          const value = returnValues[i]
          const docValue = documents[i]
          expect(value).toBeInstanceOf(BasicBase)
          expect(value.data).toEqual(docValue)
        }
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(false)
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue([])
      })
      it('checks the right path', async function () {
        const folderPaths = ['a', path.join('a', 'b')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
        await BasicBase.getAll()
        expect(spy).toHaveBeenCalledWith(folderPaths[1])
      })
      it('reads the right path', async function () {
        const folderPaths = ['a', path.join('a', 'b')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        const spy = jest.spyOn(fs, 'readdirSync').mockReturnValue([])
        await BasicBase.getAll()
        expect(spy).toHaveBeenCalledWith(folderPaths[1])
      })
      it('returns an empty array when the path does not exist', async function () {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false)
        const returnValue = await BasicBase.getAll()
        expect(returnValue).toEqual([])
      })
      it('ignores non-json files', async function () {
        const fileNames = ['a.json', 'b.json', 'c.json']
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        jest.spyOn(fs, 'readdirSync').mockReturnValue(fileNames)
        const spy = jest.spyOn(BasicBase, 'get').mockResolvedValue()
        await BasicBase.getAll()
        expect(spy).toHaveBeenCalledTimes(fileNames.length)
        expect(spy).toHaveBeenCalledWith('a')
        expect(spy).toHaveBeenCalledWith('b')
        expect(spy).toHaveBeenCalledWith('c')
      })
      it('calls get correctly', async function () {
        const fileNames = ['a.json', 'b.json', 'c.json']
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        jest.spyOn(fs, 'readdirSync').mockReturnValue(fileNames)
        const spy = jest.spyOn(BasicBase, 'get').mockResolvedValue()
        await BasicBase.getAll()
        expect(spy).toHaveBeenCalledTimes(fileNames.length)
        expect(spy).toHaveBeenCalledWith('a')
        expect(spy).toHaveBeenCalledWith('b')
        expect(spy).toHaveBeenCalledWith('c')
      })
      it('returns correctly', async function () {
        const fileNames = ['1.json', '1.json', '1.json']
        const resolveValue = 6
        const getResolves = fileNames.map(() => resolveValue)
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        jest.spyOn(fs, 'readdirSync').mockReturnValue(fileNames)
        jest.spyOn(BasicBase, 'get').mockResolvedValue(resolveValue)
        const returnValue = await BasicBase.getAll()
        expect(returnValue).toEqual(getResolves)
      })
    })
  })
  describe('delete', function () {
    it('throws an error if id is undefined', function () {
      return expect(BasicBase.delete()).rejects.toThrowError(new Error('id field is undefined'))
    })
    describe('from database', function () {
      let mockModel = createMockModel()
      beforeEach(function () {
        mockModel = createMockModel()
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(true)
        jest.spyOn(BasicBase, 'Model', 'get').mockReturnValueOnce(mockModel)
      })
      it('calls deleteOne', async function () {
        const id = 'qe3wtisgrakf'
        await BasicBase.delete(id)
        expect(mockModel.deleteOne).toHaveBeenCalledTimes(1)
        expect(mockModel.deleteOne).toHaveBeenCalledWith({ id })
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(false)
        jest.spyOn(BasicBase, 'Model', 'get').mockReturnValueOnce(createMockModel())
      })
      it('checks the right path', async function () {
        const folderPaths = ['a', path.join('a', 'b')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
        await BasicBase.delete(1)
        expect(spy).toHaveBeenCalledWith(folderPaths[1])
      })
      it(`doesn't call unlink if path doesn't exist`, async function () {
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue([])
        jest.spyOn(fs, 'existsSync').mockReturnValue(false)
        const spy = jest.spyOn(fs, 'unlinkSync')
        await BasicBase.delete(1)
        expect(spy).not.toHaveBeenCalled()
      })
      it(`calls unlink if path exists`, async function () {
        const folderPaths = ['a', 'a\\b']
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        const spy = jest.spyOn(fs, 'unlinkSync').mockReturnValue()
        const id = 'qe3tw4ryhdt'
        await BasicBase.delete(id)
        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(path.join(folderPaths[1], `${id}.json`))
      })
    })
  })
  describe('save', function () {
    beforeEach(function () {
      jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue({})
    })
    it('throws an error when called on data with mongoose model', function () {
      const base = new BasicBase()
      base.data = new mongoose.Model()
      const expectedError = new Error('Data cannot be saved when instantiated by a Model (use update instead)')
      return expect(base.save()).rejects.toThrowError(expectedError)
    })
    it('throws an error when there is no id', function () {
      const base = new BasicBase()
      base.id = undefined
      const expectedError = new Error('id field is not populated')
      return expect(base.save()).rejects.toThrowError(expectedError)
    })
    describe('from database', function () {
      let mockModel = createMockModel()
      beforeEach(function () {
        mockModel = createMockModel()
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(true)
        jest.spyOn(BasicBase, 'Model', 'get').mockReturnValue(mockModel)
      })
      it('calls findOneAndUpdate correctly', async function () {
        const options = {
          ...BasicBase.FIND_PROJECTION,
          upsert: true,
          new: true
        }
        const toObjectValue = { fo: 1 }
        const id = 1435
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue(toObjectValue)
        const base = new BasicBase()
        base.id = id
        await base.save()
        expect(mockModel.findOneAndUpdate)
          .toHaveBeenCalledWith({ id }, toObjectValue, expect.objectContaining(options))
      })
      it('returns this', async function () {
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue({})
        const base = new BasicBase()
        base.id = 123
        const returnValue = await base.save()
        expect(returnValue).toEqual(base)
      })
      it('overwrites this.data with the document', async function () {
        const document = { foo: 'bazd' }
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue({})
        mockModel.findOneAndUpdate.mockReturnValue(({ exec: () => Promise.resolve(document) }))
        const base = new BasicBase()
        base.id = 123
        await base.save()
        expect(base.data).toEqual(document)
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(false)
        jest.spyOn(BasicBase, 'Model', 'get').mockReturnValue(createMockModel())
        jest.spyOn(fs, 'writeFileSync').mockReturnValue()
      })
      it('checks all the paths', async function () {
        const folderPaths = ['a', path.join('a', 'b'), path.join('a', 'b', 'c')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        const base = new BasicBase()
        base.id = 1
        await base.save()
        expect(spy).toHaveBeenCalledTimes(folderPaths.length)
        for (let i = 0; i < folderPaths.length; ++i) {
          expect(spy.mock.calls[i]).toEqual([folderPaths[i]])
        }
      })
      it('makes the appropriate dirs', async function () {
        const folderPaths = ['a', path.join('a', 'b'), path.join('a', 'b', 'c')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        jest.spyOn(fs, 'existsSync')
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(false)
        const spy = jest.spyOn(fs, 'mkdirSync').mockReturnValue()
        const base = new BasicBase()
        base.id = 1
        await base.save()
        expect(spy).toHaveBeenCalledTimes(2)
        expect(spy.mock.calls[0]).toEqual([folderPaths[1]])
        expect(spy.mock.calls[1]).toEqual([folderPaths[2]])
      })
      it('writes the data', async function () {
        const folderPaths = ['q', path.join('q', 'w'), path.join('q', 'w', 'e')]
        const data = { fudge: 'popsicle' }
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue(data)
        const spy = jest.spyOn(fs, 'writeFileSync').mockResolvedValue()
        const id = 'q3etwgjrhnft'
        const base = new BasicBase()
        base.id = id
        await base.save()
        const writePath = path.join(folderPaths[2], `${id}.json`)
        expect(spy).toHaveBeenCalledWith(writePath, JSON.stringify(data, null, 2))
      })
      it('returns this', async function () {
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        jest.spyOn(fs, 'writeFileSync').mockResolvedValue()
        const base = new BasicBase()
        base.id = 1
        const returnValue = await base.save()
        expect(returnValue).toEqual(base)
      })
    })
  })
})

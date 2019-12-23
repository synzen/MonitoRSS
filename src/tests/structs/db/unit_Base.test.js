process.env.TEST_ENV = true
const mongoose = require('mongoose')
const Base = require('../../../structs/db/Base.js')
const config = require('../../../config.js')
const path = require('path')
const fs = require('fs')
const fsReadFileSync = fs.readFileSync
const fsWriteFileSync = fs.writeFileSync
const fsExistsSync = fs.existsSync
const fsReaddirSync = fs.readdirSync
const fsMkdirSync = fs.mkdirSync
const fsUnlinkSync = fs.unlinkSync

jest.mock('mongoose')
jest.mock('../../../config.js')

const MockModel = jest.fn()
MockModel.prototype.save = jest.fn()
MockModel.findOne = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.findByIdAndUpdate = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.findById = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.find = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.deleteOne = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.collection = {
  collectionName: 123
}

class BasicBase extends Base {
  static get Model () {
    return MockModel
  }
}

describe('Unit::Base', function () {
  afterEach(function () {
    jest.restoreAllMocks()
    MockModel.mockClear()
    MockModel.findOne.mockClear()
    MockModel.findByIdAndUpdate.mockClear()
    MockModel.find.mockClear()
    MockModel.findById.mockClear()
    MockModel.deleteOne.mockClear()
  })
  describe('constructor', function () {
    it('throws an error when Model is not implemented', function () {
      const expectedError = new Error('Model static get method must be implemented by subclasses')
      expect(() => new Base()).toThrowError(expectedError)
    })
    it(`doesn't throw an error when Model is implemented in subclass`, function () {
      const spy = jest.spyOn(Base, 'Model', 'get').mockImplementationOnce(() => {})
      expect(() => new Base()).not.toThrowError()
      spy.mockReset()
    })
    it('sets this.data', function () {
      const data = 'wr4y3e5tuj'
      const base = new BasicBase(data)
      expect(base.data).toEqual(data)
    })
    it('sets this.data to an empty object by default', function () {
      const base = new BasicBase()
      expect(base.data).toEqual({})
    })
    it('sets this._id', function () {
      const init = { _id: 'we34tryh' }
      const base = new BasicBase({ ...init })
      expect(base._id).toEqual(init._id)
    })
    it('sets this._id for mongoose ObjectId', function () {
      const init = {
        _id: new mongoose.Types.ObjectId()
      }
      const base = new BasicBase({ ...init })
      expect(base._id).toEqual(init._id.toHexString())
    })
  })
  describe('static get id', function () {
    it('returns this._id as .id', function () {
      const _id = 12345
      const base = new BasicBase({ _id, name: 'asd' })
      expect(base.id).toEqual(_id)
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
        path.join(config.database.uri, collectionName)
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
  describe('isSaved', function () {
    it('for database returns correctly', function () {
      jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(true)
      const base = new BasicBase()
      base._id = 123
      base.data = new mongoose.Model()
      expect(base.isSaved()).toEqual(true)
      base._id = undefined
      expect(base.isSaved()).toEqual(false)
      base._id = 123
      base.data = undefined
      expect(base.isSaved()).toEqual(false)
      base._id = undefined
      expect(base.isSaved()).toEqual(false)
    })
    it('for databaseless returns correctly', function () {
      jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(false)
      const base = new BasicBase()
      expect(base.isSaved()).toEqual(false)
      base._id = 1
      expect(base.isSaved()).toEqual(true)
      base._id = undefined
      expect(base.isSaved()).toEqual(false)
    })
  })
  describe('toObject', function () {
    it('throws an error when unimplemented', function () {
      const base = new BasicBase()
      expect(() => base.toObject()).toThrowError(new Error('Method must be implemented by subclasses'))
    })
    it(`doesn't throw an error when implemented`, function () {
      const base = new BasicBase()
      const spy = jest.spyOn(BasicBase.prototype, 'toObject').mockImplementation(() => {})
      expect(() => base.toObject()).not.toThrowError()
      spy.mockReset()
    })
  })
  describe('get', function () {
    it('throws an error for undefined id', function () {
      return expect(BasicBase.get()).rejects.toThrowError(new Error('Undefined id'))
    })
    it('throws an error for non-string id', function () {
      return expect(BasicBase.get(123)).rejects.toThrowError(new Error('id must be a string'))
    })
    describe('from database', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(true)
      })
      it(`uses findOne for database`, async function () {
        const id = '3w4e5rytu'
        await BasicBase.get(id)
        expect(MockModel.findById).toHaveBeenCalledWith(id)
      })
      it('returns a new Basic Base for database', async function () {
        const id = '12qw34r'
        const execReturnValue = 'w24r3'
        MockModel.findById.mockReturnValue(({ exec: () => Promise.resolve(execReturnValue) }))
        const result = await BasicBase.get(id)
        expect(result).toBeInstanceOf(BasicBase)
        expect(result.data).toEqual(execReturnValue)
      })
      it('returns null if not found', async function () {
        MockModel.findById.mockReturnValue(({ exec: () => Promise.resolve(null) }))
        const result = await BasicBase.get('asdewtgr')
        expect(result).toBeNull()
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        fs.readFileSync = jest.fn()
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(false)
      })
      afterEach(function () {
        fs.readFileSync = fsReadFileSync
        fs.existsSync = fsExistsSync
      })
      it('returns null if path does not exist', async function () {
        fs.existsSync = jest.fn(() => false)
        const returnValue = await BasicBase.get('1')
        expect(returnValue).toBeNull()
        fs.existsSync = fsExistsSync
      })
      it('returns the a new instance correctly', async function () {
        const jsonString = '{"foo": "bar"}'
        fs.existsSync = jest.fn(() => true)
        fs.readFileSync = jest.fn(() => jsonString)
        const returnValue = await BasicBase.get('1')
        expect(returnValue).toBeInstanceOf(BasicBase)
        expect(returnValue.data).toEqual({ foo: 'bar' })
      })
      it('returns null when JSON parse fails', async function () {
        const jsonString = '{"foo": bar ;}'
        fs.existsSync = jest.fn(() => true)
        fs.readFileSync = jest.fn(() => jsonString)
        const returnValue = await BasicBase.get('1')
        expect(returnValue).toBeNull()
      })
    })
  })
  describe('getMany', function () {
    it('returns correctly', async function () {
      const ids = [1, 2, 3, 4, 5]
      const spy = jest.spyOn(BasicBase, 'get').mockReturnValue(1)
      const returnValue = await BasicBase.getMany(ids)
      const expected = ids.map(() => 1)
      expect(returnValue).toEqual(expected)
      spy.mockReset()
    })
  })
  describe('getAll', function () {
    describe('from database', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(true)
      })
      it('calls find with {}', async function () {
        MockModel.find.mockReturnValue(({ exec: () => Promise.resolve([]) }))
        await BasicBase.getAll()
        expect(MockModel.find).toHaveBeenCalledWith({}, BasicBase.FIND_PROJECTION)
      })
      it('returns correctly', async function () {
        const documents = [1, 2, 3, 4, 5]
        MockModel.find.mockReturnValue(({ exec: () => Promise.resolve(documents) }))
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
      afterEach(function () {
        fs.existsSync = fsExistsSync
        fs.readdirSync = fsReaddirSync
      })
      it('checks the right path', async function () {
        const folderPaths = ['a', path.join('a', 'b')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        fs.existsSync = jest.fn(() => false)
        await BasicBase.getAll()
        expect(fs.existsSync).toHaveBeenCalledWith(folderPaths[1])
      })
      it('reads the right path', async function () {
        const folderPaths = ['a', path.join('a', 'b')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        fs.existsSync = jest.fn(() => true)
        fs.readdirSync = jest.fn(() => [])
        await BasicBase.getAll()
        expect(fs.readdirSync).toHaveBeenCalledWith(folderPaths[1])
      })
      it('returns an empty array when the path does not exist', async function () {
        fs.existsSync = jest.fn(() => false)
        const returnValue = await BasicBase.getAll()
        expect(returnValue).toEqual([])
      })
      it('ignores non-json files', async function () {
        const fileNames = ['a.json', 'b.json', 'c.json']
        fs.existsSync = jest.fn(() => true)
        fs.readdirSync = jest.fn(() => fileNames)
        const spy = jest.spyOn(BasicBase, 'get').mockResolvedValue()
        await BasicBase.getAll()
        expect(spy).toHaveBeenCalledTimes(fileNames.length)
        expect(spy).toHaveBeenCalledWith('a')
        expect(spy).toHaveBeenCalledWith('b')
        expect(spy).toHaveBeenCalledWith('c')
      })
      it('calls get correctly', async function () {
        const fileNames = ['a.json', 'b.json', 'c.json']
        fs.existsSync = jest.fn(() => true)
        fs.readdirSync = jest.fn(() => fileNames)
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
        fs.existsSync = jest.fn(() => true)
        fs.readdirSync = jest.fn(() => fileNames)
        jest.spyOn(BasicBase, 'get').mockResolvedValue(resolveValue)
        const returnValue = await BasicBase.getAll()
        expect(returnValue).toEqual(getResolves)
      })
    })
  })
  describe('delete', function () {
    it('throws an error if unsaved', function () {
      jest.spyOn(BasicBase.prototype, 'isSaved').mockReturnValue(false)
      const base = new BasicBase()
      return expect(base.delete()).rejects.toThrowError(new Error('Data has not been saved'))
    })
    describe('from database', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(true)
        jest.spyOn(BasicBase.prototype, 'isSaved').mockReturnValue(true)
      })
      it('calls remove', async function () {
        const data = { remove: jest.fn() }
        const base = new BasicBase()
        base.data = data
        await base.delete()
        expect(data.remove).toHaveBeenCalledTimes(1)
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(false)
        jest.spyOn(BasicBase.prototype, 'isSaved').mockReturnValue(true)
      })
      afterEach(function () {
        fs.existsSync = fsExistsSync
        fs.unlinkSync = fsUnlinkSync
      })
      it('checks the right path', async function () {
        const folderPaths = ['a', path.join('a', 'b')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        fs.existsSync = jest.fn(() => false)
        const id = 'wr43yeht'
        const base = new BasicBase()
        base._id = id
        await base.delete()
        expect(fs.existsSync).toHaveBeenCalledWith(path.join(folderPaths[1], `${id}.json`))
      })
      it(`doesn't call unlink if path doesn't exist`, async function () {
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        fs.existsSync = jest.fn(() => false)
        fs.unlinkSync = jest.fn(() => {})
        const base = new BasicBase()
        await base.delete()
        expect(fs.unlinkSync).not.toHaveBeenCalled()
      })
      it(`calls unlink if path exists`, async function () {
        const folderPaths = ['a', path.join('a', 'b')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        fs.existsSync = jest.fn(() => true)
        fs.unlinkSync = jest.fn()
        const id = 'qe3tw4ryhdt'
        const base = new BasicBase()
        base._id = id
        await base.delete()
        expect(fs.unlinkSync).toHaveBeenCalledTimes(1)
        expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(folderPaths[1], `${id}.json`))
      })
    })
  })
  describe('save', function () {
    it('branches correctly for mongodb', async function () {
      jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(true)
      const spy = jest.spyOn(BasicBase.prototype, 'saveToDatabase').mockImplementation()
      const base = new BasicBase()
      await base.save()
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('branches correctly for databaseless', async function () {
      jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(false)
      const spy = jest.spyOn(BasicBase.prototype, 'saveToFile').mockImplementation()
      const base = new BasicBase()
      await base.save()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
  describe('saveToDatabase', function () {
    beforeEach(function () {
      jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue({})
      jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(true)
    })
    describe('unsaved', function () {
      beforeEach(function () {
        jest.spyOn(Base.prototype, 'isSaved').mockReturnValue(false)
      })
      it('calls save correctly', async function () {
        jest.spyOn(MockModel.prototype, 'save').mockResolvedValue({})
        const base = new BasicBase()
        await base.saveToDatabase()
        expect(MockModel.mock.instances).toHaveLength(1)
        expect(MockModel.mock.instances[0].save).toHaveBeenCalledTimes(1)
      })
      it('saves _id to this', async function () {
        const _id = '34TW2EGOSJMKI'
        jest.spyOn(MockModel.prototype, 'save').mockResolvedValue({ _id })
        const base = new BasicBase()
        await base.saveToDatabase()
        expect(base._id).toEqual(_id)
      })
      it('overwrites this.data with the document', async function () {
        const document = { foo: 'bazd' }
        jest.spyOn(MockModel.prototype, 'save').mockResolvedValue({ ...document })
        const base = new BasicBase()
        await base.saveToDatabase()
        expect(base.data).toEqual({ ...document })
      })
      it('returns this', async function () {
        jest.spyOn(MockModel.prototype, 'save').mockResolvedValue({})
        const base = new BasicBase()
        const returnValue = await base.saveToDatabase()
        expect(returnValue).toEqual(base)
      })
    })
    describe('saved', function () {
      beforeEach(function () {
        jest.spyOn(Base.prototype, 'isSaved').mockReturnValue(true)
      })
      it('calls findByIdAndUpdate correctly', async function () {
        const options = {
          ...BasicBase.FIND_PROJECTION,
          upsert: true,
          new: true
        }
        const toObjectValue = { fo: 1 }
        const exec = jest.fn(() => Promise.resolve({}))
        MockModel.findByIdAndUpdate.mockReturnValue(({ exec }))
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue(toObjectValue)
        const base = new BasicBase()
        const id = 123
        base._id = id
        await base.saveToDatabase()
        expect(MockModel.findByIdAndUpdate)
          .toHaveBeenCalledWith(id, toObjectValue, expect.objectContaining(options))
        expect(exec).toHaveBeenCalled()
      })
      it('overwrites this.data with the document', async function () {
        const document = { foo: 'bazd' }
        MockModel.findByIdAndUpdate.mockReturnValue({ exec: () => Promise.resolve({ ...document }) })
        const base = new BasicBase()
        await base.saveToDatabase()
        expect(base.data).toEqual({ ...document })
      })
      it('returns this', async function () {
        const base = new BasicBase()
        MockModel.findByIdAndUpdate.mockReturnValue({ exec: () => Promise.resolve({}) })
        const returnValue = await base.saveToDatabase()
        expect(returnValue).toEqual(base)
      })
    })
  })
  describe('saveToFile', function () {
    beforeEach(function () {
      jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue({})
      fs.writeFileSync = jest.fn()
      fs.mkdirSync = jest.fn()
    })
    afterEach(function () {
      fs.writeFileSync = fsWriteFileSync
      fs.existsSync = fsExistsSync
      fs.mkdirSync = fsMkdirSync
    })
    it('checks all the paths', async function () {
      const folderPaths = ['a', path.join('a', 'b'), path.join('a', 'b', 'c')]
      jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
      fs.existsSync = jest.fn(() => true)
      const base = new BasicBase()
      await base.saveToFile()
      expect(fs.existsSync).toHaveBeenCalledTimes(folderPaths.length)
      for (let i = 0; i < folderPaths.length; ++i) {
        expect(fs.existsSync.mock.calls[i]).toEqual([folderPaths[i]])
      }
    })
    it('makes the appropriate dirs', async function () {
      const folderPaths = ['a', path.join('a', 'b'), path.join('a', 'b', 'c')]
      jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
      fs.existsSync = jest.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
      fs.mkdirSync = jest.fn()
      const base = new BasicBase()
      await base.saveToFile()
      expect(fs.mkdirSync).toHaveBeenCalledTimes(2)
      expect(fs.mkdirSync.mock.calls[0]).toEqual([folderPaths[1]])
      expect(fs.mkdirSync.mock.calls[1]).toEqual([folderPaths[2]])
    })
    describe('isSaved is true', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase.prototype, 'isSaved').mockReturnValue(true)
      })
      it('writes the data', async function () {
        const folderPaths = ['q', path.join('q', 'w'), path.join('q', 'w', 'e')]
        const data = { fudge: 'popsicle' }
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        fs.existsSync = jest.fn(() => true)
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue(data)
        const id = 'q3etwgjrhnft'
        const base = new BasicBase()
        base._id = id
        await base.saveToFile()
        const writePath = path.join(folderPaths[2], `${id}.json`)
        expect(fs.writeFileSync).toHaveBeenCalledWith(writePath, JSON.stringify(data, null, 2))
      })
      it('returns this', async function () {
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        const base = new BasicBase()
        const returnValue = await base.saveToFile()
        expect(returnValue).toEqual(base)
      })
    })
    describe('isSaved is false', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase.prototype, 'isSaved').mockReturnValue(false)
      })
      it('writes the data', async function () {
        const generatedId = '2343635erygbh5'
        jest.spyOn(mongoose.Types, 'ObjectId').mockImplementation(() => ({
          toHexString: jest.fn(() => generatedId)
        }))
        const folderPaths = ['q', path.join('q', 'w'), path.join('q', 'w', 'f')]
        const data = { fudgead: 'popsicle' }
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        fs.existsSync = jest.fn(() => true)
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue(data)
        const base = new BasicBase()
        await base.saveToFile()
        expect(fs.writeFileSync)
          .toHaveBeenCalledWith(path.join(folderPaths[2], `${generatedId}.json`), JSON.stringify(data, null, 2))
      })
      it('saves the _id to this', async function () {
        const generatedId = '2343635erh5'
        jest.spyOn(mongoose.Types, 'ObjectId').mockImplementation(() => ({
          toHexString: jest.fn(() => generatedId)
        }))
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        fs.existsSync = jest.fn(() => true)
        const base = new BasicBase()
        await base.saveToFile()
        expect(base._id).toEqual(generatedId)
      })
      it('returns this', async function () {
        jest.spyOn(mongoose.Types, 'ObjectId').mockImplementation(() => ({
          toHexString: jest.fn(() => 1)
        }))
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        fs.existsSync = jest.fn(() => true)
        const base = new BasicBase()
        const returnValue = await base.saveToFile()
        expect(returnValue).toEqual(base)
      })
    })
  })
})

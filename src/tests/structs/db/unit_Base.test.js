process.env.TEST_ENV = true
const mongoose = require('mongoose')
const Base = require('../../../structs/db/Base.js')
const config = require('../../../config.js')
const MockModel = require('./__mocks__/MockModel.js')
const BasicBase = require('./__mocks__/BasicBase.js')
const path = require('path')
const fs = require('fs')
const fsPromises = fs.promises
const fsReadFileSync = fs.readFileSync
const fsWriteFileSync = fs.writeFileSync
const fsExistsSync = fs.existsSync
const fsReaddirSync = fs.readdirSync
const fsMkdirSync = fs.mkdirSync
const fsUnlinkSync = fs.unlinkSync
const fsRmdirSync = fs.rmdirSync
const fsPromisesReaddir = fsPromises.readdir
const fsPromisesUnlink = fsPromises.unlink
const fsPromisesRmdir = fsPromises.rmdir

jest.mock('mongoose')
jest.mock('../../../config.js', () => ({
  get: jest.fn()
}))

describe('Unit::structs/db/Base', function () {
  beforeEach(function () {
    config.get.mockReturnValue({
      database: {}
    })
  })
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
    it('doesn\'t throw an error when Model is implemented in subclass', function () {
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
  })
  describe('static get isMongoDatabase', function () {
    it('calls startsWith', function () {
      const startsWith = jest.fn()
      config.get.mockReturnValue({
        database: {
          uri: {
            startsWith
          }
        }
      })
      // eslint-disable-next-line no-void
      void BasicBase.isMongoDatabase
      expect(startsWith).toHaveBeenCalled()
    })
  })
  describe('static getFolderPaths', function () {
    it('returns correctly', function () {
      const databaseURI = 'abc'
      config.get.mockReturnValue({
        database: {
          uri: databaseURI
        }
      })
      const collectionName = 'def'
      const spy = jest.spyOn(BasicBase, 'Model', 'get').mockReturnValue({
        collection: {
          collectionName
        }
      })
      const result = BasicBase.getFolderPaths()
      expect(result).toEqual([
        databaseURI,
        path.join(databaseURI, collectionName)
      ])
      spy.mockRestore()
    })
  })
  describe('static getField', function () {
    it('returns the data from plain object', function () {
      const base = new BasicBase()
      const field = 'we4ryhdt'
      const value = 'sw34rye5htd'
      base.data = { [field]: value }
      const returnValue = base.getField(field)
      expect(returnValue).toEqual(value)
    })
    it('returns undefined if not found in either', function () {
      const base = new BasicBase()
      base.data = {}
      expect(base.getField('abc')).toEqual(undefined)
      base.data = new mongoose.Model()
      expect(base.getField('abc')).toEqual(undefined)
    })
  })
  describe('static resolveObject', function () {
    it('returns undefined for empty object', function () {
      expect(Base.resolveObject({})).toBeUndefined()
    })
    it('returns the webhook if defined', function () {
      const data = {
        foo: 'baz',
        id: '123'
      }
      expect(Base.resolveObject({ ...data })).toEqual(data)
    })
  })
  describe('toObject', function () {
    it('throws an error when unimplemented', function () {
      const base = new BasicBase()
      expect(() => base.toObject()).toThrowError(new Error('Method must be implemented by subclasses'))
    })
    it('doesn\'t throw an error when implemented', function () {
      const base = new BasicBase()
      const spy = jest.spyOn(BasicBase.prototype, 'toObject').mockImplementation(() => {})
      expect(() => base.toObject()).not.toThrowError()
      spy.mockReset()
    })
  })
  describe('toJSON', function () {
    it('returns toObject by default', function () {
      const base = new BasicBase()
      const toObjectValue = 3456
      jest.spyOn(base, 'toObject').mockReturnValue(toObjectValue)
      expect(base.toJSON()).toEqual(toObjectValue)
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
      it('uses findOne for database', async function () {
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
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a', 'b'])
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
      it('checks and reads the right file path', async function () {
        fs.existsSync = jest.fn(() => true)
        await BasicBase.get('abc')
        expect(fs.existsSync)
          .toHaveBeenCalledWith(path.join('b', 'abc.json'))
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
  describe('getByQuery', function () {
    describe('from database', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(true)
      })
      it('calls findOne correctly', async function () {
        const field = '234wt6r'
        const value = 'w23et43'
        const query = {
          [field]: value
        }
        await BasicBase.getByQuery(query)
        expect(MockModel.findOne).toHaveBeenCalledWith(query, BasicBase.FIND_PROJECTION)
      })
      it('returns a new instance correctly', async function () {
        const doc = {
          hello: 'world'
        }
        const exec = jest.fn(() => doc)
        jest.spyOn(MockModel, 'findOne').mockReturnValue({ exec })
        const returnValue = await BasicBase.getByQuery({})
        expect(returnValue).toBeInstanceOf(BasicBase)
      })
      it('returns null correctly', async function () {
        const exec = jest.fn(() => null)
        jest.spyOn(MockModel, 'findOne').mockReturnValue({ exec })
        const returnValue = await BasicBase.getByQuery({})
        expect(returnValue).toBeNull()
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(false)
      })
      it('returns a new isntance', async function () {
        jest.spyOn(BasicBase, 'getManyByQuery').mockResolvedValue([1])
        await expect(BasicBase.getByQuery()).resolves.toBeInstanceOf(BasicBase)
      })
      it('returns null when none found', async function () {
        jest.spyOn(BasicBase, 'getManyByQuery').mockResolvedValue([])
        await expect(BasicBase.getByQuery()).resolves.toBeNull()
      })
    })
  })
  describe('getBy', function () {
    it('calls getByQuery correctly', async function () {
      const spy = jest.spyOn(BasicBase, 'getByQuery').mockResolvedValue()
      const field = 'w2346tyer5thujg'
      const value = 'swe4t69ruyghj'
      await BasicBase.getBy(field, value)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith({ [field]: value })
    })
  })
  describe('getManyByQuery', function () {
    describe('from database', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockResolvedValue(true)
      })
      it('calls find correctly', async function () {
        const query = {
          assrfh: 'srhyedhy',
          joe: 1,
          ahaaa: []
        }
        jest.spyOn(MockModel, 'find').mockReturnValue({ exec: () => [] })
        await BasicBase.getManyByQuery(query)
        expect(MockModel.find).toHaveBeenCalledWith(query, BasicBase.FIND_PROJECTION)
      })
      it('returns a new array correctly', async function () {
        const exec = jest.fn(() => [{}, {}])
        jest.spyOn(MockModel, 'find').mockReturnValue({ exec })
        const returnValues = await BasicBase.getManyByQuery()
        expect(returnValues).toBeInstanceOf(Array)
        expect(returnValues).toHaveLength(2)
        for (const val of returnValues) {
          expect(val).toBeInstanceOf(BasicBase)
        }
      })
      it('returns empty array correctly', async function () {
        const exec = jest.fn(() => [])
        jest.spyOn(MockModel, 'find').mockReturnValue({ exec })
        const returnValues = await BasicBase.getManyByQuery()
        expect(returnValues).toHaveLength(0)
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(false)
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['1'])
        fs.existsSync = jest.fn()
        fs.readFileSync = jest.fn()
        fsPromises.readdir = jest.fn()
      })
      afterEach(function () {
        fs.existsSync = fsExistsSync
        fsPromises.readdir = fsPromisesReaddir
        fs.readFileSync = fsReadFileSync
      })
      it('returns empty array if path does not exist', async function () {
        fs.existsSync.mockReturnValue(false)
        const returned = await BasicBase.getManyByQuery({})
        expect(returned).toEqual([])
      })
      it('returns a single match', async function () {
        const read1 = JSON.stringify({ key1: 'abcgfd' })
        const readFail = '{wetfrg:}'
        const read2 = JSON.stringify({ key1: 'gh', key2: 123 })
        const read3 = JSON.stringify({ key1: 'gh', key: '2' })
        fsPromises.readdir.mockResolvedValue(['1', '2', '3'])
        fs.existsSync.mockReturnValue(true)
        fs.readFileSync
          .mockReturnValueOnce(read1)
          .mockReturnValueOnce(readFail)
          .mockReturnValueOnce(read2)
          .mockReturnValueOnce(read3)
        const returned = await BasicBase.getManyByQuery({
          key1: 'gh',
          key2: 123
        })
        expect(returned).toHaveLength(1)
        expect(returned[0]).toBeInstanceOf(BasicBase)
        await expect(BasicBase.getManyBy('random', 'key'))
          .resolves.toEqual([])
      })
      it('returns multiple matches', async function () {
        const read1Object = { key: 'rwse4yhg', george: 1, fal: 6 }
        const read2Object = { key: read1Object.key, lucas: 1, fal: read1Object.fal }
        const read1 = JSON.stringify(read1Object)
        const read2 = JSON.stringify(read2Object)
        fsPromises.readdir.mockResolvedValue(['1', '2'])
        fs.existsSync.mockReturnValue(true)
        fs.readFileSync
          .mockReturnValueOnce(read1)
          .mockReturnValueOnce(read2)
        const returned = await BasicBase.getManyByQuery({
          key: read1Object.key,
          fal: read1Object.fal
        })
        expect(returned).toHaveLength(2)
      })
    })
  })
  describe('getManyBy', function () {
    it('calls getManyByQuery correctly', async function () {
      const spy = jest.spyOn(BasicBase, 'getManyByQuery').mockResolvedValue()
      const field = 'wt4ryhedt'
      const value = 'srye57thr'
      await BasicBase.getManyBy(field, value)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith({ [field]: value })
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
  describe('static deleteAll', function () {
    describe('from database', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(true)
      })
      it('calls deleteMany correctly', async function () {
        await BasicBase.deleteAll()
        expect(MockModel.deleteMany).toHaveBeenCalledTimes(1)
        expect(MockModel.deleteMany).toHaveBeenCalledWith({})
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValue(false)
        fs.rmdirSync = jest.fn()
        fs.existsSync = jest.fn()
        fsPromises.readdir = jest.fn()
        fsPromises.unlink = jest.fn()
        fsPromises.rmdir = jest.fn()
      })
      afterEach(function () {
        fs.rmdirSync = fsRmdirSync
        fs.existsSync = fsExistsSync
        fsPromises.readdir = fsPromisesReaddir
        fsPromises.unlink = fsPromisesUnlink
        fsPromises.rmdir = fsPromisesRmdir
      })
      it('doesn\'t call rmdir if the folder doesn\'t exist', async function () {
        fs.existsSync.mockReturnValue(false)
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a', 'b'])
        await BasicBase.deleteAll()
        expect(fs.existsSync).toHaveBeenCalledWith('b')
        expect(fs.rmdirSync).not.toHaveBeenCalled()
      })
      it('calls rmdir if the folder exists', async function () {
        fs.existsSync.mockReturnValue(true)
        fsPromises.readdir.mockResolvedValue(['file1.json', 'file2.json'])
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a', 'b'])
        await BasicBase.deleteAll()
        expect(fs.existsSync).toHaveBeenCalledWith('b')
        expect(fsPromises.rmdir).toHaveBeenCalledWith('b')
      })
      it('deletes files within the directory', async function () {
        fs.existsSync.mockReturnValue(true)
        fsPromises.readdir.mockResolvedValue(['file1.json', 'file2.json'])
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a', 'b'])
        await BasicBase.deleteAll()
        expect(fsPromises.unlink).toHaveBeenCalledTimes(2)
        expect(fsPromises.unlink).toHaveBeenCalledWith(path.join('b', 'file1.json'))
        expect(fsPromises.unlink).toHaveBeenCalledWith(path.join('b', 'file2.json'))
      })
    })
  })
  describe('delete', function () {
    it('throws an error if unsaved', function () {
      const base = new BasicBase()
      base._saved = false
      return expect(base.delete()).rejects.toThrowError(new Error('Data has not been saved'))
    })
    describe('from database', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(true)
      })
      it('calls remove', async function () {
        const data = { remove: jest.fn() }
        const base = new BasicBase()
        base._saved = true
        base.document = data
        await base.delete()
        expect(data.remove).toHaveBeenCalledTimes(1)
      })
    })
    describe('from databaseless', function () {
      beforeEach(function () {
        jest.spyOn(BasicBase, 'isMongoDatabase', 'get').mockReturnValueOnce(false)
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
        base._saved = true
        base._id = id
        await base.delete()
        expect(fs.existsSync).toHaveBeenCalledWith(path.join(folderPaths[1], `${id}.json`))
      })
      it('doesn\'t call unlink if path doesn\'t exist', async function () {
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        fs.existsSync = jest.fn(() => false)
        fs.unlinkSync = jest.fn(() => {})
        const base = new BasicBase()
        base._saved = true
        await base.delete()
        expect(fs.unlinkSync).not.toHaveBeenCalled()
      })
      it('calls unlink if path exists', async function () {
        const folderPaths = ['a', path.join('a', 'b')]
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        fs.existsSync = jest.fn(() => true)
        fs.unlinkSync = jest.fn()
        const id = 'qe3tw4ryhdt'
        const base = new BasicBase()
        base._saved = true
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
      jest.spyOn(MockModel.prototype, 'save').mockResolvedValue({
        toJSON: jest.fn(() => ({}))
      })
    })
    describe('unsaved', function () {
      it('calls save correctly', async function () {
        const base = new BasicBase()
        base._saved = false
        await base.saveToDatabase()
        expect(MockModel.mock.instances).toHaveLength(1)
        expect(MockModel.mock.instances[0].save).toHaveBeenCalledTimes(1)
      })
      it('overwrites this.document with the document', async function () {
        const document = {
          foo: 'bazd',
          toJSON: () => ({})
        }
        jest.spyOn(MockModel.prototype, 'save').mockResolvedValue({ ...document })
        const base = new BasicBase()
        base._saved = false
        await base.saveToDatabase()
        expect(base.document).toEqual({ ...document })
      })
      it('overwrites this.data with the doc data', async function () {
        const data = {
          foo: 21
        }
        const document = {
          foo: 'bazd',
          toJSON: () => data
        }
        jest.spyOn(MockModel.prototype, 'save').mockResolvedValue({ ...document })
        const base = new BasicBase()
        base._saved = false
        await base.saveToDatabase()
        expect(base.data).toEqual(data)
      })
      it('returns this', async function () {
        const base = new BasicBase()
        base._saved = false
        const returnValue = await base.saveToDatabase()
        expect(returnValue).toEqual(base)
      })
      it('deletes undefined keys', async function () {
        const base = new BasicBase()
        const toSave = {
          foo: 12345,
          bar: undefined,
          buck: undefined
        }
        const expectedSave = {
          foo: 12345
        }
        const id = 123
        base._id = id
        base._saved = false
        jest.spyOn(base, 'toObject').mockReturnValue(toSave)
        await base.saveToDatabase()
        expect(MockModel.mock.calls[0][0]).toEqual(expectedSave)
      })
      it('sets save property properly', async function () {
        const base = new BasicBase()
        base._saved = false
        await base.saveToDatabase()
        expect(base._saved).toEqual(true)
      })
    })
    describe('saved', function () {
      const savedDocumentMock = {
        toJSON: jest.fn(() => ({}))
      }
      it('calls data.set on all keys properly', async function () {
        const toObjectValue = {
          fo: 1,
          fq: 'az',
          gsd: 'frdbhg'
        }
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue(toObjectValue)
        const base = new BasicBase()
        base._saved = true
        base.document = {
          save: jest.fn(() => savedDocumentMock),
          set: jest.fn()
        }
        await base.saveToDatabase()
        for (const key in toObjectValue) {
          expect(base.document.set).toHaveBeenCalledWith(key, toObjectValue[key])
        }
      })
      it('calls save', async function () {
        const base = new BasicBase()
        base._saved = true
        base.document = {
          set: jest.fn(),
          save: jest.fn(() => savedDocumentMock)
        }
        await base.saveToDatabase()
        expect(base.document.save).toHaveBeenCalled()
      })
      it('updates this.data', async function () {
        const base = new BasicBase()
        base._saved = true
        const serializedDoc = { foo: 'baz', a: 2 }
        const savedDoc = {
          toJSON: jest.fn(() => serializedDoc)
        }
        base.document = {
          save: jest.fn(() => savedDoc)
        }
        await base.saveToDatabase()
        expect(savedDoc.toJSON).toHaveBeenCalled()
        expect(base.data).toEqual(JSON.parse(JSON.stringify(serializedDoc)))
      })
      it('returns this', async function () {
        const base = new BasicBase()
        base._saved = true
        base.document = {
          save: jest.fn(() => savedDocumentMock)
        }
        const returnValue = await base.saveToDatabase()
        expect(returnValue).toEqual(base)
      })
      it('updates this class data', async function () {
        const toSave = {
          is: '35u4',
          good: 'wet4'
        }
        jest.spyOn(BasicBase.prototype, 'toObject').mockReturnValue(toSave)
        const base = new BasicBase()
        base._saved = true
        const savedDocumentObject = {
          random: 'key',
          is: 1,
          good: 1234
        }
        const savedDocument = {
          toJSON: jest.fn(() => savedDocumentObject)
        }
        base.document = {
          save: jest.fn(() => savedDocument),
          set: jest.fn()
        }
        await base.saveToDatabase()
        expect(base.is).toEqual(savedDocumentObject.is)
        expect(base.good).toEqual(savedDocumentObject.good)
        expect(base.random).toBeUndefined()
      })
    })
  })
  describe('saveToFile', function () {
    beforeEach(function () {
      jest.spyOn(BasicBase.prototype, 'toJSON').mockReturnValue({})
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
    it('deletes undefined keys', async function () {
      const toSave = {
        foo: '123',
        baz: undefined,
        bar: undefined
      }
      const expectedSave = {
        foo: toSave.foo
      }
      jest.spyOn(BasicBase.prototype, 'toJSON').mockReturnValue(toSave)
      jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
      const base = new BasicBase()
      await base.saveToFile()
      expect(fs.writeFileSync.mock.calls[0][1]).toEqual(JSON.stringify(expectedSave, null, 2))
    })
    describe('_saved is true', function () {
      it('writes the data', async function () {
        const folderPaths = ['q', path.join('q', 'w'), path.join('q', 'w', 'e')]
        const data = { fudge: 'popsicle' }
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(folderPaths)
        fs.existsSync = jest.fn(() => true)
        jest.spyOn(BasicBase.prototype, 'toJSON').mockReturnValue(data)
        const id = 'q3etwgjrhnft'
        const base = new BasicBase()
        base._saved = true
        base._id = id
        await base.saveToFile()
        const writePath = path.join(folderPaths[2], `${id}.json`)
        expect(fs.writeFileSync).toHaveBeenCalledWith(writePath, JSON.stringify(data, null, 2))
      })
      it('returns this', async function () {
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        const base = new BasicBase()
        base._saved = true
        const returnValue = await base.saveToFile()
        expect(returnValue).toEqual(base)
      })
      it('deletes undefined keys', async function () {
        const toSave = {
          foo: '123',
          baz: undefined,
          bar: undefined
        }
        const expectedSave = {
          foo: toSave.foo
        }
        jest.spyOn(BasicBase.prototype, 'toJSON').mockReturnValue(toSave)
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        const base = new BasicBase()
        base._saved = true
        await base.saveToFile()
        expect(fs.writeFileSync.mock.calls[0][1]).toEqual(JSON.stringify(expectedSave, null, 2))
      })
    })
    describe('_saved is false', function () {
      beforeEach(function () {
        jest.spyOn(mongoose.Types, 'ObjectId').mockImplementation(() => ({
          toHexString: jest.fn(() => 1)
        }))
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
        jest.spyOn(BasicBase.prototype, 'toJSON').mockReturnValue(data)
        const base = new BasicBase()
        base._saved = false
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
        base._saved = false
        await base.saveToFile()
        expect(base._id).toEqual(generatedId)
      })
      it('returns this', async function () {
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        fs.existsSync = jest.fn(() => true)
        const base = new BasicBase()
        base._saved = false
        const returnValue = await base.saveToFile()
        expect(returnValue).toEqual(base)
      })
      it('sets saved property', async function () {
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        fs.existsSync = jest.fn(() => true)
        const base = new BasicBase()
        base._saved = false
        await base.saveToFile()
        expect(base._saved).toEqual(true)
      })
      it('adds _id to the file if it doesn\'t already exists', async function () {
        const newId = 'qa3et54wry'
        jest.spyOn(mongoose.Types, 'ObjectId').mockImplementation(() => ({
          toHexString: jest.fn(() => newId)
        }))
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        fs.existsSync = jest.fn(() => true)
        const base = new BasicBase()
        base._saved = false
        await base.saveToFile()
        const writtenTo = fs.writeFileSync.mock.calls[0][0]
        const written = fs.writeFileSync.mock.calls[0][1]
        expect(JSON.parse(written)._id).toEqual(newId)
        expect(writtenTo).toEqual(path.join('a', `${newId}.json`))
      })
      it('uses the current _id and adds it to the file if already exists', async function () {
        const _id = 'heasdz'
        jest.spyOn(BasicBase.prototype, 'toJSON').mockReturnValue({
          _id
        })
        jest.spyOn(BasicBase, 'getFolderPaths').mockReturnValue(['a'])
        fs.existsSync = jest.fn(() => true)
        const base = new BasicBase()
        base._saved = false
        await base.saveToFile()
        const writtenTo = fs.writeFileSync.mock.calls[0][0]
        const written = fs.writeFileSync.mock.calls[0][1]
        expect(JSON.parse(written)._id).toEqual(_id)
        expect(writtenTo).toEqual(path.join('a', `${_id}.json`))
      })
    })
  })
})

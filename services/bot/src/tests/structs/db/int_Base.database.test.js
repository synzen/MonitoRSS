process.env.TEST_ENV = true
const Foobar = require('./__mocks__/Foobar.js')
const FoobarClass = require('./__mocks__/FoobarClass.js')
const mongoose = require('mongoose')
const dbName = 'test_int_base'
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

describe('Int::structs/db/Base Database', function () {
  const collectionName = Foobar.collection.collectionName
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
  })
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase()
  })
  describe('getAll', () => {
    it('works', async () => {
      const docs = [{
        foo: '1'
      }, {
        foo: '2'
      }, {
        foo: '3'
      }, {
        foo: '4'
      }, {
        foo: '5'
      }]
      await mongoose.connection.collection(collectionName).insertMany(docs)
      const found = await FoobarClass.getAll()
      expect(found.length).toEqual(5)
      for (const doc of docs) {
        expect(found.findIndex(f => f.foo === doc.foo)).toBeGreaterThan(-1)
      }
    })
  })
  describe('getAllByPagination', () => {
    it.only('works', async () => {
      const docs = [{
        foo: '1'
      }, {
        foo: '2'
      }, {
        foo: '3'
      }, {
        foo: '4'
      }, {
        foo: '5'
      }]
      await mongoose.connection.collection(collectionName).insertMany(docs)
      const found = await FoobarClass.getAllByPagination(2)
      expect(found.length).toEqual(5)
      for (const doc of docs) {
        expect(found.findIndex(f => f.foo === doc.foo)).toBeGreaterThan(-1)
      }
    })
  })
  it('initializes correctly', async function () {
    const initData = { foo: 'qgfdew4' }
    const initFoobar = new Foobar(initData)
    const doc = await initFoobar.save()
    const foobar = new FoobarClass(doc)
    expect(foobar.data).toEqual(JSON.parse(JSON.stringify(doc.toObject())))
    expect(foobar.document).toBeInstanceOf(mongoose.Model)
    expect(foobar._saved).toEqual(false)
    await doc.remove()
  })
  it('saves', async function () {
    const data = {
      foo: '349y5hjt',
      baz: 666
    }
    const foobar = new FoobarClass(data)
    expect(foobar._saved).toEqual(false)
    await foobar.save()
    expect(foobar.document).toBeInstanceOf(mongoose.Model)
    expect(foobar._saved).toEqual(true)
    const found = Foobar.findOne(data).exec()
    expect(found).toBeDefined()
  })
  it('gets', async function () {
    const initData = { foo: 'q352tew4', baz: 235 }
    const initFoobar = new Foobar(initData)
    const doc = await initFoobar.save()
    const foobar = await FoobarClass.get(doc._id.toHexString())
    expect(foobar.document).toBeInstanceOf(mongoose.Model)
    expect(foobar.data).toEqual(JSON.parse(JSON.stringify(doc.toObject())))
    for (const key in initData) {
      expect(foobar[key]).toEqual(initData[key])
    }
  })
  it('getsBy', async function () {
    const initData1 = {
      foo: 'baz',
      baz: 1
    }
    const initData2 = {
      foo: 'bfgjz',
      baz: 2
    }
    const initData3 = {
      foo: 'bfgjz',
      baz: 3
    }
    await new Foobar(initData1).save()
    await new Foobar(initData2).save()
    await new Foobar(initData3).save()
    const found = await FoobarClass.getBy('foo', 'bfgjz')
    expect(found.data).toEqual(expect.objectContaining(initData2))
  })
  it('deletes', async function () {
    const initFoobar = new Foobar({ foo: 'abc' })
    const doc = await initFoobar.save()
    const foobar = new FoobarClass(doc, true)
    await foobar.delete()
    const queried = await Foobar.findById(doc._id.toHexString())
    expect(queried).toBeNull()
  })
  it('gets many', async function () {
    const a = new Foobar({ foo: 'a' })
    const b = new Foobar({ foo: 'b' })
    const saves = await Promise.all([a.save(), b.save()])
    const [id1, id2] = saves.map(doc => doc._id.toHexString())
    const classes = await FoobarClass.getMany([id1, id2])
    expect(classes.length).toEqual(2)
    for (const item of classes) {
      expect(item).toBeInstanceOf(FoobarClass)
    }
    expect(classes[0].foo).toEqual('a')
    expect(classes[1].foo).toEqual('b')
  })
  it('updates', async function () {
    const initData = { foo: 'exquisite' }
    const initFoobar = new Foobar(initData)
    const doc = await initFoobar.save()
    const foobar = new FoobarClass(doc, true)
    const newFooValue = 'changzz'
    foobar.foo = newFooValue
    await foobar.save()
    const found = await Foobar.findById(initFoobar.id)
    expect(found.foo).toEqual(newFooValue)
  })
  it('deletes a key on undefined', async function () {
    const initData = { foo: 'w49ti093u4j', baz: 987 }
    const initFoobar = new Foobar(initData)
    const doc = await initFoobar.save()
    const foobar = new FoobarClass(doc, true)
    foobar.foo = undefined
    await foobar.save()
    const found = await Foobar.findById(initFoobar.id).lean().exec()
    expect(Object.keys(found)).not.toContain('foo')
  })
  it('doesn\'t add keys after update', async function () {
    const initData = { foo: 'w49t4qwej', baz: 976 }
    const foobar = new FoobarClass(initData)
    const saved = await foobar.save()
    foobar.foo = 'abc'
    await foobar.save()
    const found = await Foobar.findById(saved._id).lean().exec()
    expect(found.nullField).toBeUndefined()
  })
  it('doesn\'t set object field when undefined', async function () {
    const initData = { foo: 'w44jk', baz: 135749 }
    const foobar = new FoobarClass(initData)
    const saved = await foobar.save()
    const found = await Foobar.findById(saved._id).lean().exec()
    expect(Object.keys(found)).not.toContain('object')
  })
  it('doesn\'t set object field when undefined after update', async function () {
    const initData = { foo: 'w44zj', baz: 136679 }
    const foobar = new FoobarClass(initData)
    const saved = await foobar.save()
    foobar.foo = 'zack'
    await foobar.save()
    const found = await Foobar.findById(saved._id).lean().exec()
    expect(Object.keys(found)).not.toContain('object')
  })
  it('sets default empty array', async function () {
    const initData = { foo: 'w4h4j', baz: 13111 }
    const foobar = new FoobarClass(initData)
    expect(foobar.array).toBeInstanceOf(Array)
    expect(foobar.array).toHaveLength(0)
  })
  it('doesn\'t remove the array when updated', async function () {
    const initData = { foo: 'wf44j', baz: 53579 }
    const foobar = new FoobarClass(initData)
    const saved = await foobar.save()
    foobar.foo = 'qwe'
    await foobar.save()
    const found = await Foobar.findById(saved._id).lean().exec()
    expect(Object.keys(found)).toContain('array')
  })
  it('autocasts to ObjectId for strings', async function () {
    const initData = { objectId: new mongoose.Types.ObjectId().toHexString() }
    const foobar = new FoobarClass(initData)
    expect(foobar.save()).resolves.toEqual(foobar)
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})

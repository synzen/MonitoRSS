process.env.TEST_ENV = true
const Foobar = require('./__mocks__/Foobar.js')
const FoobarClass = require('./__mocks__/FoobarClass.js')
const mongoose = require('mongoose')
const dbName = 'test_int_base'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::Base Database', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
  })
  it('initializes correctly', async function () {
    const initData = { foo: 'qgfdew4' }
    const initFoobar = new Foobar(initData)
    const doc = await initFoobar.save()
    const foobar = new FoobarClass(doc)
    expect(foobar.data).toBeInstanceOf(mongoose.Model)
    expect(foobar.isSaved()).toEqual(true)
    await doc.remove()
  })
  it('saves', async function () {
    const data = {
      foo: '349y5hjt',
      baz: 666
    }
    const foobar = new FoobarClass(data)
    expect(foobar.isSaved()).toEqual(false)
    await foobar.save()
    expect(foobar.data).toBeInstanceOf(mongoose.Model)
    expect(foobar.isSaved()).toEqual(true)
    const found = Foobar.findOne(data).exec()
    expect(found).toBeDefined()
  })
  it('gets', async function () {
    const initData = { foo: 'q352tew4', baz: 235 }
    const initFoobar = new Foobar(initData)
    const doc = await initFoobar.save()
    const foobar = await FoobarClass.get(doc._id.toHexString())
    expect(foobar.data).toBeInstanceOf(mongoose.Model)
    for (const key in initData) {
      expect(foobar[key]).toEqual(initData[key])
    }
  })
  it('deletes', async function () {
    const initFoobar = new Foobar({ foo: 'abc' })
    const doc = await initFoobar.save()
    const foobar = new FoobarClass(doc)
    await foobar.delete()
    const queried = await Foobar.findById(doc._id.toHexString())
    expect(queried).toBeNull()
  })
  it('gets many', async function () {
    const a = new Foobar({ foo: 'a' })
    const b = new Foobar({ foo: 'b' })
    const saves = await Promise.all([ a.save(), b.save() ])
    const [ id1, id2 ] = saves.map(doc => doc._id.toHexString())
    const classes = await FoobarClass.getMany([ id1, id2 ])
    expect(classes.length).toEqual(2)
    for (const item of classes) {
      expect(item).toBeInstanceOf(FoobarClass)
    }
    expect(classes[0].foo).toEqual('a')
    expect(classes[1].foo).toEqual('b')
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})

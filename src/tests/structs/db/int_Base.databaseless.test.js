process.env.TEST_ENV = true
const config = require('../../../config.js')
const fs = require('fs')
const path = require('path')
const util = require('util')
const fsReadFile = util.promisify(fs.readFile)
const fsReaddir = util.promisify(fs.readdir)
const fsWriteFile = util.promisify(fs.writeFile)
const fsUnlink = util.promisify(fs.unlink)
const fsRmdir = util.promisify(fs.rmdir)
const FoobarClass = require('./__mocks__/FoobarClass.js')
const Foobar = require('./__mocks__/Foobar.js')

describe('Int::Base Databaseless', function () {
  const originalDatabaseUri = config.database.uri
  let folderPath = ''
  beforeAll(async function () {
    config.database.uri = '___intbase_tests_'
    folderPath = path.join(config.database.uri, Foobar.collection.collectionName)
  })
  it('saves', async function () {
    const data = { foo: 'zz', baz: 99 }
    const foobar = new FoobarClass(data)
    const returned = await foobar.save()
    const fileName = returned._id
    expect(fileName).toBeDefined()
    const filePath = path.join(folderPath, `${fileName}.json`)
    expect(fs.existsSync(filePath)).toEqual(true)
    const read = JSON.parse(await fsReadFile(filePath))
    expect(read).toEqual(data)
    await fsUnlink(filePath)
  })
  it('deletes', async function () {
    const data = { foo: 'zzx', baz: 999 }
    const _id = 'ghj23tgrehtrgf'
    const filePath = path.join(folderPath, `${_id}.json`)
    await fsWriteFile(filePath, JSON.stringify(data, null, 2))
    expect(fs.existsSync(filePath)).toEqual(true)
    const foobar = new FoobarClass({ ...data, _id })
    await foobar.delete()
    expect(fs.existsSync(filePath)).toEqual(false)
  })
  it('gets many', async function () {
    const data = { foo: 'zzx', baz: 999 }
    const data2 = { foo: 'zxccb' }
    const _id = 'ghj23tgrehtrgf'
    const _id2 = 'aedgswrhft'
    const filePath = path.join(folderPath, `${_id}.json`)
    const filePath2 = path.join(folderPath, `${_id2}.json`)
    await Promise.all([
      fsWriteFile(filePath, JSON.stringify(data, null, 2)),
      fsWriteFile(filePath2, JSON.stringify(data2, null, 2))
    ])
    expect(fs.existsSync(filePath)).toEqual(true)
    expect(fs.existsSync(filePath2)).toEqual(true)
    const foobar = new FoobarClass({ ...data, _id })
    const foobar2 = new FoobarClass({ ...data2, _id: _id2 })
    const foobars = await FoobarClass.getMany([ _id, _id2 ])
    expect(foobars).toHaveLength(2)
    for (const key in data) {
      expect(foobar[key]).toEqual(data[key])
    }
    for (const key in data2) {
      expect(foobar2[key]).toEqual(data2[key])
    }
    await Promise.all([ fsUnlink(filePath), fsUnlink(filePath2) ])
  })
  afterAll(async function () {
    const files = await fsReaddir(folderPath)
    if (files.length > 0) {
      await Promise.all(files.map(fileName => fsUnlink(path.join(folderPath, fileName))))
    }
    await fsRmdir(folderPath)
    await fsRmdir(config.database.uri)
    config.database.uri = originalDatabaseUri
  })
})

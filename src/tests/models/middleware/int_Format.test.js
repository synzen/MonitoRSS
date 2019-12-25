const mongoose = require('mongoose')
const Format = require('../../../models/Format.js').model
const dbName = 'test_int_middleware_Format'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::models/middleware/Format', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  describe('checkEmptyField', function () {
    it('does not save empty fields', async function () {
      const populatedField = {
        name: 'hello',
        value: 'hello'
      }
      const format = new Format({
        title: 'hellodsgj',
        embeds: [{
          fields: [{}, populatedField]
        }]
      })
      const saved = await format.save()
      expect(saved.embeds.length).toEqual(1)
      expect(saved.embeds[0].fields.length).toEqual(1)
      expect(saved.embeds[0].fields[0])
        .toEqual(expect.objectContaining(populatedField))
      await saved.remove()
    })
    it('does not save incomplete fields', async function () {
      const incompleteField = {
        name: 'abc'
      }
      const populatedField = {
        name: 'hello',
        value: 'hello'
      }
      const format = new Format({
        title: 'helhgjflo',
        embeds: [{
          fields: [
            incompleteField,
            populatedField,
            incompleteField
          ]
        }]
      })
      const saved = await format.save()
      expect(saved.embeds.length).toEqual(1)
      expect(saved.embeds[0].fields.length).toEqual(1)
      expect(saved.embeds[0].fields[0])
        .toEqual(expect.objectContaining(populatedField))
      await saved.remove()
    })
    it('does not save empty embed', async function () {
      const format = new Format({
        embeds: [{
          fields: []
        }, {
          footerText: 'Heyo'
        }, {}]
      })
      const saved = await format.save()
      expect(saved.embeds.length).toEqual(1)
      expect(saved.embeds[0].footerText).toEqual('Heyo')
      await saved.remove()
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})

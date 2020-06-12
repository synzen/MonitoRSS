process.env.TEST_ENV = true
const Subscriber = require('../../../structs/db/Subscriber.js')

jest.mock('../../../config.js')

describe('Unit::structs/db/Subscriber', function () {
  const initData = {
    feed: 'abc',
    id: '123',
    type: 'role'
  }
  describe('constructor', function () {
    it('throws an error for missing feed', function () {
      const data = {
        id: 'awnb',
        type: 'role'
      }
      expect(() => new Subscriber(data))
        .toThrow('feed is undefined')
    })
    it('throws an error for missing id', function () {
      const data = {
        type: 'role',
        feed: '123'
      }
      expect(() => new Subscriber(data))
        .toThrow('id is undefined')
    })
    it('throws an error for invalid type', function () {
      const data = {
        id: '123',
        type: 'fgh',
        feed: '123'
      }
      expect(() => new Subscriber(data))
        .toThrow('type must be "user" or "role"')
    })
    it('does not throw error for proper data', function () {
      const data = {
        id: '123',
        type: 'role',
        feed: '123'
      }
      expect(() => new Subscriber(data)).not.toThrow()
      data.type = 'user'
      expect(() => new Subscriber(data)).not.toThrow()
    })
  })
  describe('static get TYPES', function () {
    it('returns correctly', function () {
      expect(Subscriber.TYPES).toEqual({
        USER: 'user',
        ROLE: 'role'
      })
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const subscriber = new Subscriber({ ...initData })
      expect(subscriber.toObject()).toEqual({
        filters: new Map(),
        rfilters: new Map(),
        ...initData
      })
    })
  })
  describe('toJSON', function () {
    it('returns correctly', function () {
      const subscriber = new Subscriber({ ...initData })
      expect(subscriber.toJSON()).toEqual({
        filters: {},
        rfilters: {},
        ...initData
      })
    })
  })
  describe('validate', function () {
    it('throws an error if type is not user or role', function () {
      const subscriber = new Subscriber({ ...initData })
      subscriber.type = 'haa'
      return expect(subscriber.validate())
        .rejects.toThrow('type must be "user" or "role"')
    })
    it('does not throw for user or role type', async function () {
      const subscriber = new Subscriber({ ...initData })
      subscriber.type = 'role'
      await expect(subscriber.validate()).resolves.toEqual(undefined)
      subscriber.type = 'user'
      await expect(subscriber.validate()).resolves.toEqual(undefined)
    })
  })
  describe('getMentionText', function () {
    it('returns user mention string correctly', function () {
      const subscriber = new Subscriber({ ...initData })
      subscriber.id = '54eu6ryi'
      subscriber.type = Subscriber.TYPES.USER
      const expected = `<@${subscriber.id}>`
      expect(subscriber.getMentionText())
        .toEqual(expected)
    })
    it('returns role mention string correctly', function () {
      const subscriber = new Subscriber({ ...initData })
      subscriber.id = '54eu6ryi'
      subscriber.type = Subscriber.TYPES.ROLE
      const expected = `<@&${subscriber.id}>`
      expect(subscriber.getMentionText())
        .toEqual(expected)
    })
  })
})

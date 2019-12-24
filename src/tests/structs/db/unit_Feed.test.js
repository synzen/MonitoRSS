const Feed = require('../../../structs/db/Feed.js')

describe('Unit::Feed', function () {
  const keys = [
    'checkDates',
    'checkTitles',
    'formatTables',
    'imgLinksExistence',
    'imgPreviews',
    'toggleRoleMentions'
  ]
  const necessaryInit = {
    title: 1,
    channel: 1,
    url: 1,
    guild: 1
  }
  describe('constructor', function () {
    it(`throws an error when title is missing`, function () {
      expect(() => new Feed({ channel: 1, url: 1, guild: 1 }))
        .toThrowError(new Error('Undefined title'))
    })
    it(`throws an error when channel is missing`, function () {
      expect(() => new Feed({ title: 1, url: 1, guild: 1 }))
        .toThrowError(new Error('Undefined channel'))
    })
    it(`throws an error when url is missing`, function () {
      expect(() => new Feed({ title: 1, channel: 1, guild: 1 }))
        .toThrowError(new Error('Undefined url'))
    })
    it(`throws an error when guild is missing`, function () {
      expect(() => new Feed({ title: 1, url: 1, channel: 1 }))
        .toThrowError(new Error('Undefined guild'))
    })
    it('sets defined values from arg', function () {
      const init = {
        ...necessaryInit
      }
      let val = 'awsfde'
      for (const key of keys) {
        val += 'r'
        init[key] = val
      }
      init.webhook = {
        id: 'asb',
        avatar: 'adsef',
        name: 'adesgrf'
      }
      const feed = new Feed({ ...init })
      for (const key in init) {
        expect(feed[key]).toEqual(init[key])
      }
    })
  })
  describe('toObject', function () {
    it('returns a plain with the right keys', function () {
      const feed = new Feed({ ...necessaryInit })
      const exported = feed.toObject()
      expect(Object.prototype.toString.call(exported) === '[object Object]').toEqual(true)
      for (const key of keys) {
        expect(exported[key]).toEqual(feed[key])
      }
      for (const key in necessaryInit) {
        expect(exported[key]).toEqual(necessaryInit[key])
      }
    })
  })
  describe('get webhook', function () {
    it('returns undefined for empty object', function () {
      const feed = new Feed({ ...necessaryInit })
      feed._webhook = {}
      expect(feed.webhook).toBeUndefined()
    })
    it('returns the webhook if defined', function () {
      const feed = new Feed({ ...necessaryInit })
      const webhook = {
        foo: 'baz',
        id: '123'
      }
      feed._webhook = { ...webhook }
      expect(feed.webhook).toEqual(webhook)
    })
  })
  describe('set webhook', function () {
    it('throws an error if not object', function () {
      const feed = new Feed({ ...necessaryInit })
      expect(() => {
        feed.webhook = 123
      }).toThrowError(new Error('Webhook must be an object'))
    })
    it('throws an error if no id', function () {
      const feed = new Feed({ ...necessaryInit })
      expect(() => {
        feed.webhook = {
          george: 'costanza'
        }
      }).toThrowError(new Error('id must be specified'))
    })
    it('sets correctly', function () {
      const feed = new Feed({ ...necessaryInit })
      const webhook = {
        id: 123,
        name: 'aszdfe',
        avatar: 'ewstrg',
        george: 'costanza'
      }
      const expected = {
        id: webhook.id,
        name: webhook.name,
        avatar: webhook.avatar
      }
      expect(() => {
        feed.webhook = { ...webhook }
      }).not.toThrowError()
      expect(feed._webhook).toEqual(expected)
    })
  })
})

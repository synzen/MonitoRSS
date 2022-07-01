process.env.TEST_ENV = true
const Feed = require('../../../structs/db/Feed.js')
const Schedule = require('../../../structs/db/Schedule.js')
const Supporter = require('../../../structs/db/Supporter.js')
const FilteredFormat = require('../../../structs/db/FilteredFormat.js')
const Guild = require('../../../structs/Guild.js')

jest.mock('../../../structs/db/FilteredFormat.js')
jest.mock('../../../structs/db/Schedule.js')
jest.mock('../../../structs/db/Supporter.js')
jest.mock('../../../config.js')

describe('Unit::structs/db/Feed', function () {
  const keys = [
    'checkDates',
    'formatTables',
    'imgLinksExistence',
    'imgPreviews',
    'text',
    'ncomparisons',
    'pcomparisons'
  ]
  const necessaryInit = {
    title: 'e5rh',
    channel: 'e5rhy',
    url: 'swr4y',
    guild: 'wa4eyh'
  }
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('throws an error when channel is missing', function () {
      expect(() => new Feed({ title: 1, url: 1, guild: 1 }))
        .toThrowError(new Error('Undefined channel'))
    })
    it('throws an error when url is missing', function () {
      expect(() => new Feed({ title: 1, channel: 1, guild: 1 }))
        .toThrowError(new Error('Undefined url'))
    })
    it('throws an error when guild is missing', function () {
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
      init._id = 'abc'
      init.embeds = [{ a: 1, b: 2 }]
      init.disabled = true
      init.ncomparisons = ['a', 'b']
      init.pcomparisons = ['c', 'd']
      const feed = new Feed({ ...init })
      for (const key in init) {
        expect(feed[key]).toEqual(init[key])
      }
      expect(feed._id).toEqual(init._id)
      expect(feed.webhook).toEqual(init.webhook)
      expect(feed.embeds).toEqual(init.embeds)
      expect(feed.disabled).toEqual(init.disabled)
      expect(feed.ncomparisons).toEqual(init.ncomparisons)
      expect(feed.pcomparisons).toEqual(init.pcomparisons)
    })
  })
  describe('toObject', function () {
    it('exports the _id if it exists', function () {
      const feed = new Feed({ ...necessaryInit, _id: 123 })
      const exported = feed.toObject()
      expect(exported._id).toEqual(123)
    })
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
      expect(exported).not.toHaveProperty('_id')
    })
    it('adds the _id if it exists', function () {
      const _id = 'W34REY5'
      const feed = new Feed({
        ...necessaryInit,
        _id
      })
      const exported = feed.toObject()
      expect(exported._id).toEqual(_id)
    })
    it('returns returns regexOps as a map', function () {
      const feed = new Feed({ ...necessaryInit })
      const regexOps = {
        description: [{
          name: 'swrgf',
          search: {
            regex: 'awsf'
          }
        }, {
          name: 'swrgf2',
          search: {
            regex: 'awsf'
          }
        }]
      }
      feed.regexOps = regexOps
      const exported = feed.toObject()
      const expected = new Map()
      expected.set('description', regexOps.description)
      expect(exported.regexOps).toBeInstanceOf(Map)
      expect(exported.regexOps).toEqual(expected)
    })
  })
  describe('toJSON', function () {
    it('exports the _id if it exists', function () {
      const feed = new Feed({ ...necessaryInit, _id: 123 })
      const exported = feed.toJSON()
      expect(exported._id).toEqual(123)
    })
    it('returns regexOps as plain object', function () {
      const feed = new Feed({ ...necessaryInit })
      const regexOps = {
        description: [{
          name: 'swrgf',
          search: {
            regex: 'awsf'
          }
        }, {
          name: 'swrgf2',
          search: {
            regex: 'awsf'
          }
        }]
      }
      feed.regexOps = { ...regexOps }
      const exported = feed.toJSON()
      expect(exported.regexOps).not.toBeInstanceOf(Map)
      expect(exported.regexOps).toEqual(regexOps)
    })
    it('returns filters as objects', function () {
      const feed = new Feed({ ...necessaryInit })
      feed.filters = {
        title: ['1']
      }
      feed.rfilters = {
        description: ['erdg']
      }
      const exported = feed.toJSON()
      expect(exported.filters).not.toBeInstanceOf(Map)
      expect(exported.rfilters).not.toBeInstanceOf(Map)
    })
    it('returns the correct keys', function () {
      const feed = new Feed({ ...necessaryInit })
      for (const key of keys) {
        feed[key] = 1
      }
      const exported = feed.toJSON()
      for (const key of keys) {
        expect(exported[key]).toEqual(feed[key])
      }
    })
  })
  describe('set webhook', function () {
    it('sets correctly', function () {
      const feed = new Feed({ ...necessaryInit })
      const webhook = {
        id: 123,
        name: 'aszdfe',
        avatar: 'ewstrg',
        george: 'costanza'
      }
      feed.webhook = webhook
      expect(feed._webhook).toEqual(webhook)
    })
  })
  describe('set split', function () {
    it('sets correctly', function () {
      const feed = new Feed({ ...necessaryInit })
      const split = {
        id: 123,
        hawa: 'asdf'
      }
      feed.webhook = split
      expect(feed._webhook).toEqual(split)
    })
  })
  describe('getFilteredFormats', function () {
    it('calls correctly', async function () {
      const _id = 'q23tw45erey5h'
      const feed = new Feed({ ...necessaryInit })
      feed._id = _id
      await feed.getFilteredFormats()
      expect(FilteredFormat.getManyBy).toHaveBeenCalledWith('feed', _id)
    })
  })
  describe('enable', function () {
    it('calls this.save', async function () {
      const feed = new Feed({ ...necessaryInit })
      feed.disabled = 'hura'
      const spy = jest.spyOn(feed, 'save').mockResolvedValue()
      await feed.enable()
      expect(spy).toHaveBeenCalled()
    })
    it('sets this.disabled to undefined', async function () {
      const feed = new Feed({ ...necessaryInit })
      feed.disabled = 'hoopa dooop'
      jest.spyOn(feed, 'save').mockResolvedValue()
      await feed.enable()
      expect(feed.disabled).toEqual(undefined)
    })
  })
  describe('disable', function () {
    it('calls this.save', async function () {
      const feed = new Feed({ ...necessaryInit })
      const spy = jest.spyOn(feed, 'save').mockResolvedValue()
      await feed.disable()
      expect(spy).toHaveBeenCalled()
    })
    it('sets this.disabled to the reason given', async function () {
      const feed = new Feed({ ...necessaryInit })
      jest.spyOn(feed, 'save').mockResolvedValue()
      const reason = 'hoopa doop'
      await feed.disable(reason)
      expect(feed.disabled).toEqual(reason)
    })
    it('sets this.disabled to the default reason if none given', async function () {
      const feed = new Feed({ ...necessaryInit })
      jest.spyOn(feed, 'save').mockResolvedValue()
      await feed.disable()
      expect(feed.disabled).toEqual('No reason specified')
    })
  })
  describe('hasFastSupporterSchedule', function () {
    it('returns correctly if set of guilds passed in', async function () {
      const feed = new Feed({ ...necessaryInit })
      const supporterGuilds = new Set(['a', 'b', 'c'])
      feed.guild = 'a'
      await expect(feed.hasFastSupporterSchedule(supporterGuilds))
        .resolves.toEqual(true)
      feed.guild = 'd'
      await expect(feed.hasFastSupporterSchedule(supporterGuilds))
        .resolves.toEqual(false)
    })
    it('returns correctly if guild was found and has slow rate', async function () {
      jest.spyOn(Guild.prototype, 'getSubscription')
        .mockResolvedValue({
          slowRate: true
        })
      const feed = new Feed({ ...necessaryInit })
      await expect(feed.hasFastSupporterSchedule()).resolves.toEqual(false)
    })
    it('returns correctly if guild was found and does not have slow rate', async function () {
      jest.spyOn(Guild.prototype, 'getSubscription')
        .mockResolvedValue({
          slowRate: false
        })
      const feed = new Feed({ ...necessaryInit })
      await expect(feed.hasFastSupporterSchedule()).resolves.toEqual(true)
    })
    it('returns correctly for supporter if nothing passed in', async function () {
      jest.spyOn(Guild.prototype, 'getSubscription')
        .mockResolvedValue(null)
      jest.spyOn(Guild.prototype, 'getSupporter')
        .mockResolvedValueOnce({ hasSlowRate: async () => false })
        .mockResolvedValueOnce({ hasSlowRate: async () => true })
      const feed = new Feed({ ...necessaryInit })
      await expect(feed.hasFastSupporterSchedule()).resolves.toEqual(true)
      await expect(feed.hasFastSupporterSchedule()).resolves.toEqual(false)
    })
  })
  describe('determineSchedule', function () {
    const schedules = [{
      name: 'default'
    }, {
      name: 'sched1',
      feeds: ['aa', 'bb', 'cc'],
      keywords: ['key1', 'key2']
    }, {
      name: 'sched2',
      feeds: ['id1', 'id2', 'id3'],
      keywords: ['yek1', 'yek2']
    }]
    beforeEach(function () {
      Schedule.getAll.mockResolvedValue([])
      Supporter.getValidSupporterOfGuild.mockResolvedValue([])
    })
    afterEach(function () {
      Schedule.getAll.mockReset()
      Supporter.getValidSupporterOfGuild.mockReset()
    })
    it('calls Schedule.getAll if it is not passed in', async function () {
      const feed = new Feed({ ...necessaryInit })
      await feed.determineSchedule(undefined, [])
      expect(Schedule.getAll).toHaveBeenCalledTimes(1)
    })
    it('returns the supporter schedule if supported', async function () {
      const origSchedule = Supporter.schedule
      Supporter.schedule = {
        foo: 'bar'
      }
      Supporter.enabled = true
      const feed = new Feed({ ...necessaryInit })
      jest.spyOn(feed, 'hasFastSupporterSchedule')
        .mockResolvedValue(true)
      const determined = await feed.determineSchedule([])
      expect(determined).toEqual(Supporter.schedule)
      Supporter.schedule = origSchedule
      Supporter.enabled = false
    })
    it('does not return the supporter schedule if supported', async function () {
      const origSchedule = Supporter.schedule
      Supporter.schedule = {
        foo: 'bar'
      }
      Supporter.enabled = true
      const feed = new Feed({ ...necessaryInit })
      feed.url = 'feed43'
      jest.spyOn(feed, 'hasFastSupporterSchedule')
        .mockResolvedValue(true)
      const determined = await feed.determineSchedule([])
      expect(determined).not.toEqual(Supporter.schedule)
      Supporter.schedule = origSchedule
      Supporter.enabled = false
    })
    it('returns the schedule that has the feed\'s id', async function () {
      const feed = new Feed({ ...necessaryInit })
      feed._id = 'id1'
      feed.url = 'no match'
      const schedule = await feed.determineSchedule(schedules, [])
      expect(schedule).toEqual(schedules[2])
    })
    it('returns the schedule if it has a keyword in the feed\'s url', async function () {
      const feed = new Feed({ ...necessaryInit })
      feed._id = 'no match'
      feed.url = 'dun yek2 haz'
      const schedule = await feed.determineSchedule(schedules, [])
      expect(schedule).toEqual(schedules[2])
    })
    it('returns the default schedule if it matches no schedules', async function () {
      const feed = new Feed({ ...necessaryInit })
      feed._id = 'no match'
      feed.url = 'no match'
      const schedule = await feed.determineSchedule(schedules, [])
      expect(schedule).toEqual(schedules[0])
    })
  })
})

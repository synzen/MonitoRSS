process.env.TEST_ENV = true
const FeedData = require('../../structs/FeedData.js')
const Profile = require('../../structs/db/Profile.js')
const Feed = require('../../structs/db/Feed.js')

jest.mock('../../structs/db/Profile.js')
jest.mock('../../structs/db/Feed.js')
jest.mock('../../config.js')

const INIT_DATA = {
  feed: 1
}

describe('Unit::structs/FeedData', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
    Profile.get.mockReset()
    Feed.prototype.getSubscribers.mockReset()
    Feed.prototype.getFilteredFormats.mockReset()
  })
  describe('constructor', function () {
    it('throws an error if feed is missing', function () {
      expect(() => new FeedData({}))
        .toThrowError('Missing feed for FeedData')
    })
    it('initializes correctly', function () {
      const data = {
        feed: 1,
        profile: 2,
        subscribers: 3,
        filteredFormats: 4
      }
      const feedData = new FeedData(data)
      for (const key in data) {
        expect(feedData[key]).toEqual(data[key])
      }
    })
  })
  describe('toObject', function () {
    it('returns the toObject of every piece of data', function () {
      const feedData = new FeedData({ ...INIT_DATA })
      const feedToObj = {
        key: 'abc'
      }
      feedData.feed = {
        toObject: jest.fn(() => feedToObj)
      }
      const profileToObj = 2
      feedData.profile = {
        toObject: jest.fn(() => profileToObj)
      }
      const subscriber1ToObj = 3
      const subscriber2ToObj = 4
      feedData.subscribers = [{
        toObject: jest.fn(() => subscriber1ToObj)
      }, {
        toObject: jest.fn(() => subscriber2ToObj)
      }]
      const filteredFormat1ToObj = 5
      const filteredFormat2ToObj = 6
      feedData.filteredFormats = [{
        toObject: jest.fn(() => filteredFormat1ToObj)
      }, {
        toObject: jest.fn(() => filteredFormat2ToObj)
      }]
      const returned = feedData.toObject()
      expect(returned).toEqual({
        ...feedToObj,
        profile: 2,
        subscribers: [3, 4],
        filteredFormats: [5, 6]
      })
    })
  })
  describe('toJSON', function () {
    it('returns the toObject of every piece of data', function () {
      const feedData = new FeedData({ ...INIT_DATA })
      const feedToJSON = {
        key: 'anb'
      }
      feedData.feed = {
        toJSON: jest.fn(() => feedToJSON)
      }
      const profileToJSON = 2
      feedData.profile = {
        toJSON: jest.fn(() => profileToJSON)
      }
      const subscriber1ToJSON = 3
      const subscriber2ToJSON = 4
      feedData.subscribers = [{
        toJSON: jest.fn(() => subscriber1ToJSON)
      }, {
        toJSON: jest.fn(() => subscriber2ToJSON)
      }]
      const filteredFormat1ToJSON = 5
      const filteredFormat2ToJSON = 6
      feedData.filteredFormats = [{
        toJSON: jest.fn(() => filteredFormat1ToJSON)
      }, {
        toJSON: jest.fn(() => filteredFormat2ToJSON)
      }]
      const returned = feedData.toJSON()
      expect(returned).toEqual({
        ...feedToJSON,
        profile: 2,
        subscribers: [3, 4],
        filteredFormats: [5, 6]
      })
    })
  })
  describe('static getFeedAssociations', function () {
    it('returns the right data', async function () {
      const profile = 99
      const subscribers = [1, 2]
      const filteredFormats = [3, 4]
      const feed = {
        getSubscribers: jest.fn(() => subscribers),
        getFilteredFormats: jest.fn(() => filteredFormats)
      }
      Profile.get.mockResolvedValue(profile)
      const returned = await FeedData.getFeedAssociations(feed)
      expect(returned).toEqual({
        profile,
        subscribers,
        filteredFormats
      })
    })
  })
  describe('static get', function () {
    it('returns null if no feed', async function () {
      Feed.get.mockResolvedValue(null)
      const returned = await FeedData.get('qr43ew')
      expect(returned).toBeNull()
    })
    it('returns the data if found', async function () {
      const feed = 123
      Feed.get.mockResolvedValue(feed)
      const feedAssociations = {
        profile: 1,
        subscribers: 2,
        filteredFormats: 3
      }
      const ofunc = FeedData.getFeedAssociations
      FeedData.getFeedAssociations = jest.fn(() => feedAssociations)
      const returned = await FeedData.get()
      expect(returned).toEqual({
        feed,
        ...feedAssociations
      })
      FeedData.getFeedAssociations = ofunc
    })
  })
  describe('static getManyBy', function () {
    it('returns FeedData', async function () {
      const feeds = [1, 2, 3]
      Feed.getManyBy.mockResolvedValue(feeds)
      const associations = [{
        profile: 'pro1',
        subscribers: 'sub1',
        filteredFormats: 'ff1'
      }, {
        profile: 'pro2',
        subscribers: 'sub2',
        filteredFormats: 'ff2'
      }, {
        profile: 'pro3',
        subscribers: 'sub3',
        filteredFormats: 'ff3'
      }]
      const oval = FeedData.getFeedAssociations
      FeedData.getFeedAssociations = jest.fn()
        .mockResolvedValueOnce(associations[0])
        .mockResolvedValueOnce(associations[1])
        .mockResolvedValueOnce(associations[2])
      const feedDatas = await FeedData.getManyBy()
      expect(feedDatas).toHaveLength(feeds.length)
      for (let i = 0; i < feedDatas.length; ++i) {
        const feedData = feedDatas[i]
        expect(feedData).toBeInstanceOf(FeedData)
      }
      FeedData.getFeedAssociations = oval
    })
    it('calls Feed getManyBy correctly', async function () {
      const field = 'q3re'
      const value = 'wte4rsyh'
      Feed.getManyBy.mockResolvedValue([])
      await FeedData.getManyBy(field, value)
      expect(Feed.getManyBy).toHaveBeenCalledWith(field, value)
    })
    it('returns empty array with no found feeds', async function () {
      Feed.getManyBy.mockResolvedValue([])
      const returned = await FeedData.getManyBy()
      expect(returned).toEqual([])
    })
  })
  describe('static getAll', function () {
    it('returns FeedData', async function () {
      const feeds = [1, 2, 3]
      Feed.getAll.mockResolvedValue(feeds)
      const associations = [{
        profile: 'pro1',
        subscribers: 'sub1',
        filteredFormats: 'ff1'
      }, {
        profile: 'pro2',
        subscribers: 'sub2',
        filteredFormats: 'ff2'
      }, {
        profile: 'pro3',
        subscribers: 'sub3',
        filteredFormats: 'ff3'
      }]
      const oval = FeedData.getFeedAssociations
      FeedData.getFeedAssociations = jest.fn()
        .mockResolvedValueOnce(associations[0])
        .mockResolvedValueOnce(associations[1])
        .mockResolvedValueOnce(associations[2])
      const feedDatas = await FeedData.getAll()
      expect(feedDatas).toHaveLength(feeds.length)
      for (let i = 0; i < feedDatas.length; ++i) {
        const feedData = feedDatas[i]
        expect(feedData).toBeInstanceOf(FeedData)
      }
      FeedData.getFeedAssociations = oval
    })
    it('calls Feed getAll correctly', async function () {
      Feed.getAll.mockResolvedValue([])
      await FeedData.getAll()
      expect(Feed.getAll).toHaveBeenCalled()
    })
    it('returns empty array with no found feeds', async function () {
      Feed.getAll.mockResolvedValue([])
      const returned = await FeedData.getAll()
      expect(returned).toEqual([])
    })
  })
  describe('ofFeed', function () {
    it('returns correctly', async function () {
      const associations = {
        profile: 'b',
        subscribers: 'd'
      }
      jest.spyOn(FeedData, 'getFeedAssociations')
        .mockResolvedValue(associations)
      const feed = {
        foo: 'bar'
      }
      const returned = await FeedData.ofFeed(feed)
      expect(returned).toBeInstanceOf(FeedData)
    })
  })
})

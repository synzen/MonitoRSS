process.env.TEST_ENV = true
const Patron = require('../../../structs/db/Patron.js')
const config = require('../../../config.js')

jest.mock('../../../config.js', () => ({
  get: () => ({
    feeds: {
      max: 3.5
    }
  })
}))

describe('Unit::structs/db/Patron', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  const initData = {
    _id: '123s4',
    status: '32hj5',
    lastCharge: 'sdhb',
    pledgeLifetime: 123,
    pledge: 123,
    name: 'q3e2w64yre7',
    email: 'szadgrf'
  }
  describe('constructor', function () {
    it('throws for undefined _id', function () {
      const data = {
        status: 'ased',
        pledgeLifetime: 123,
        pledge: 123,
        name: 'easdg',
        email: 'segdt'
      }
      expect(() => new Patron(data))
        .toThrow(new TypeError('_id is undefined'))
    })
    it('throws for undefined pledgeLifetime', function () {
      const data = {
        _id: '1234',
        status: '325',
        pledge: 123,
        name: 'easdg',
        email: 'segdt'
      }
      expect(() => new Patron(data))
        .toThrow(new TypeError('pledgeLifetime is undefined'))
    })
    it('throws for undefined pledge', function () {
      const data = {
        _id: '1234',
        status: '325',
        lastCharge: 'szfxrhd',
        pledgeLifetime: 123,
        name: 'easdg',
        email: 'segdt'
      }
      expect(() => new Patron(data))
        .toThrow(new TypeError('pledge is undefined'))
    })
    it('does not throws for undefined name, email, lastCharge and status', function () {
      const data = {
        _id: '1234',
        pledgeLifetime: 123,
        pledge: 123
      }
      expect(() => new Patron(data))
        .not.toThrow()
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const patron = new Patron({ ...initData })
      expect(patron.toObject()).toEqual(initData)
    })
  })
  describe('determineMaxFeeds', function () {
    describe('inactive patron', function () {
      it('returns config.feeds.max', function () {
        jest.spyOn(Patron.prototype, 'isActive').mockReturnValue(false)
        const patron = new Patron({ ...initData })
        const max = config.get().feeds.max
        expect(patron.determineMaxFeeds()).toEqual(max)
      })
    })
    describe('active patron', function () {
      beforeEach(function () {
        jest.spyOn(Patron.prototype, 'isActive').mockReturnValue(true)
      })
      it('returns 140 for >= 2000 for pledge', function () {
        const patron = new Patron({ ...initData })
        patron.pledge = 2111
        expect(patron.determineMaxFeeds()).toEqual(140)
        patron.pledge = 2000
        expect(patron.determineMaxFeeds()).toEqual(140)
      })
      it('returns 70 for >= 1000 for pledge', function () {
        const patron = new Patron({ ...initData })
        patron.pledge = 1100
        expect(patron.determineMaxFeeds()).toEqual(70)
        patron.pledge = 1000
        expect(patron.determineMaxFeeds()).toEqual(70)
      })
      it('returns 35 for >= 500 for pledge', function () {
        const patron = new Patron({ ...initData })
        patron.pledge = 511
        expect(patron.determineMaxFeeds()).toEqual(35)
        patron.pledge = 500
        expect(patron.determineMaxFeeds()).toEqual(35)
      })
      it('returns 15 for >= 250 for pledge', function () {
        const patron = new Patron({ ...initData })
        patron.pledge = 255
        expect(patron.determineMaxFeeds()).toEqual(15)
        patron.pledge = 250
        expect(patron.determineMaxFeeds()).toEqual(15)
      })
      it('returns default for < 250 for pledge', function () {
        const patron = new Patron({ ...initData })
        patron.pledge = 249
        const max = config.get().feeds.max
        expect(patron.determineMaxFeeds()).toEqual(max)
      })
    })
  })
  describe('determineMaxGuilds', function () {
    describe('inactive patron', function () {
      it('returns 1', function () {
        jest.spyOn(Patron.prototype, 'isActive').mockReturnValue(false)
        const patron = new Patron({ ...initData })
        expect(patron.determineMaxGuilds()).toEqual(1)
      })
    })
    describe('active patron', function () {
      beforeEach(function () {
        jest.spyOn(Patron.prototype, 'isActive').mockReturnValue(true)
      })
      it('returns 4 for >= 2500 for pledgeLifetime', function () {
        const patron = new Patron({ ...initData })
        patron.pledgeLifetime = 2511
        expect(patron.determineMaxGuilds()).toEqual(4)
        patron.pledgeLifetime = 2500
        expect(patron.determineMaxGuilds()).toEqual(4)
      })
      it('returns 3 for >= 1500 for pledgeLifetime', function () {
        const patron = new Patron({ ...initData })
        patron.pledgeLifetime = 1511
        expect(patron.determineMaxGuilds()).toEqual(3)
        patron.pledgeLifetime = 1500
        expect(patron.determineMaxGuilds()).toEqual(3)
      })
      it('returns 2 for >= 500 for pledgeLifetime', function () {
        const patron = new Patron({ ...initData })
        patron.pledgeLifetime = 511
        expect(patron.determineMaxGuilds()).toEqual(2)
        patron.pledgeLifetime = 500
        expect(patron.determineMaxGuilds()).toEqual(2)
      })
      it('returns 1 for < 500 for pledgeLifetime', function () {
        const patron = new Patron({ ...initData })
        patron.pledgeLifetime = 499
        expect(patron.determineMaxGuilds()).toEqual(1)
      })
    })
  })
  describe('isActive', function () {
    it('returns true for active status', function () {
      const patron = new Patron({ ...initData })
      patron.status = Patron.STATUS.ACTIVE
      expect(patron.isActive()).toEqual(true)
    })
    it('returns false for unknown status', function () {
      const patron = new Patron({ ...initData })
      patron.status = 'drshtrj'
      expect(patron.isActive()).toEqual(false)
    })
    it('returns false for former status', function () {
      const patron = new Patron({ ...initData })
      patron.status = Patron.STATUS.FORMER
      expect(patron.isActive()).toEqual(false)
    })
    describe('declined status', function () {
      it('returns false for > 3 days ago', function () {
        const longAgo = new Date(new Date().toUTCString())
        longAgo.setDate(longAgo.getDate() - 4)
        const patron = new Patron({ ...initData })
        patron.status = Patron.STATUS.DECLINED
        patron.lastCharge = longAgo.toString()
        expect(patron.isActive()).toEqual(false)
      })
      it('returns true for <= 3 days ago', function () {
        const longAgo = new Date(new Date().toUTCString())
        longAgo.setDate(longAgo.getDate() - 3)
        const patron = new Patron({ ...initData })
        patron.status = Patron.STATUS.DECLINED
        patron.lastCharge = longAgo.toString()
        expect(patron.isActive()).toEqual(true)
      })
      it('returns false for missing charge date', function () {
        const patron = new Patron({ ...initData })
        patron.status = Patron.STATUS.DECLINED
        patron.lastCharge = undefined
        expect(patron.isActive()).toEqual(false)
      })
    })
  })
  describe('determineWebhook', function () {
    describe('inactive patron', function () {
      it('returns false', function () {
        jest.spyOn(Patron.prototype, 'isActive').mockReturnValue(false)
        const patron = new Patron({ ...initData })
        expect(patron.determineWebhook()).toEqual(false)
      })
    })
    describe('active patron', function () {
      beforeEach(function () {
        jest.spyOn(Patron.prototype, 'isActive').mockReturnValue(true)
      })
      it('returns true for >= 100', function () {
        const patron = new Patron({ ...initData })
        patron.pledge = 101
        expect(patron.determineWebhook()).toEqual(true)
        patron.pledge = 100
        expect(patron.determineWebhook()).toEqual(true)
      })
      it('returns false for < 100', function () {
        const patron = new Patron({ ...initData })
        patron.pledge = 99
        expect(patron.determineWebhook()).toEqual(false)
      })
    })
  })
})

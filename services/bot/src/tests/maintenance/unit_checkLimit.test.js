process.env.TEST_ENV = true
const Guild = require('../../structs/Guild.js')
const Supporter = require('../../structs/db/Supporter.js')
const checkLimits = require('../../maintenance/checkLimits.js')
const config = require('../../config.js')

jest.mock('../../config.js', () => ({
  get: jest.fn(() => ({
    feeds: {
      max: 2
    }
  }))
}))
jest.mock('../../structs/db/Supporter.js')
jest.mock('../../structs/Guild.js')
jest.mock('../../util/ipc.js')

describe('Unit::maintenance/checkLimits', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
    Supporter.enabled = false
    Supporter.getValidSupporters
      .mockResolvedValue([])
    Guild.getAllUniqueFeedLimits
      .mockResolvedValue(new Map())
  })
  afterEach(function () {
    config.get.mockReturnValue({
      feeds: {
        max: 2
      }
    })
  })
  describe('limits', function () {
    it('calls enable on disabled feeds for feeds under limit', async function () {
      const feeds = [{
        guild: 'a'
      }, {
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn(),
        disable: jest.fn()
      }, {
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn(),
        disable: jest.fn()
      }]
      jest.spyOn(Guild, 'getAllUniqueFeedLimits')
        .mockResolvedValue(new Map())
      await checkLimits.limits(feeds)
      expect(feeds[1].enable).toHaveBeenCalledTimes(1)
      expect(feeds[1].disable).not.toHaveBeenCalled()
      expect(feeds[2].enable).not.toHaveBeenCalled()
      expect(feeds[2].disable).not.toHaveBeenCalled()
    })
    it('calls disable on enabled feeds for feeds over limit', async function () {
      const feeds = [{
        // Enabled
        guild: 'a',
        disabled: undefined,
        disable: jest.fn(),
        enable: jest.fn()
      }, {
        // Enabled
        guild: 'a',
        disabled: undefined,
        disable: jest.fn(),
        enable: jest.fn()
      }, {
        // Enabled, over limit
        guild: 'a',
        disabled: undefined,
        disable: jest.fn(),
        enable: jest.fn()
      }, {
        // Disabled, nothing should be called
        guild: 'a',
        disabled: 'Exceeded feed limit',
        disable: jest.fn(),
        enable: jest.fn()
      }]
      jest.spyOn(Guild, 'getAllUniqueFeedLimits')
        .mockResolvedValue(new Map())
      await checkLimits.limits(feeds)
      expect(feeds[0].disable).not.toHaveBeenCalled()
      expect(feeds[0].enable).not.toHaveBeenCalled()
      expect(feeds[1].disable).not.toHaveBeenCalled()
      expect(feeds[1].enable).not.toHaveBeenCalled()
      expect(feeds[2].enable).not.toHaveBeenCalled()
      expect(feeds[2].disable).toHaveBeenCalledTimes(1)
      expect(feeds[3].enable).not.toHaveBeenCalled()
      expect(feeds[3].disable).not.toHaveBeenCalled()
    })
    it('calls enable and disable on feeds under and over limits', async function () {
      const feeds = [{
        // Enabled
        guild: 'a',
        disabled: undefined
      }, {
        // Disabled, should be enabled since it's the 2nd feed
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn(),
        disable: jest.fn()
      }, {
        // Enabled, should be disabled since the limit is 2
        guild: 'a',
        disabled: undefined,
        enable: jest.fn(),
        disable: jest.fn()
      }]
      jest.spyOn(Guild, 'getAllUniqueFeedLimits')
        .mockResolvedValue(new Map())
      await checkLimits.limits(feeds)
      expect(feeds[1].disable).not.toHaveBeenCalled()
      expect(feeds[1].enable).toHaveBeenCalledTimes(1)
      expect(feeds[2].enable).not.toHaveBeenCalled()
      expect(feeds[2].disable).toHaveBeenCalledTimes(1)
    })
    it('calls returns the number of enabled and disabled', async function () {
      const feeds = [{
        // Enabled
        guild: 'a',
        disabled: undefined
      }, {
        // Disabled, should be enabled since it's the 2nd feed
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn().mockResolvedValue('feed1'),
        disable: jest.fn()
      }, {
        // Enabled, should be disabled since the limit is 2
        guild: 'a',
        disabled: undefined,
        enable: jest.fn(),
        disable: jest.fn().mockResolvedValue('feed2')
      }]
      jest.spyOn(Guild, 'getAllUniqueFeedLimits')

        .mockResolvedValue(new Map())
      const result = await checkLimits.limits(feeds)
      expect(result.enabled).toEqual(['feed1'])
      expect(result.disabled).toEqual(['feed2'])
    })
    it('uses the supporter limit if available for guild', async function () {
      const feeds = [{
        // Enabled
        guild: 'a',
        disabled: undefined
      }, {
        // Enabled
        guild: 'a',
        disabled: undefined
      }, {
        // Enabled, over limit
        guild: 'a',
        disabled: undefined,
        disable: jest.fn()
      }, {
        // Disabled, nothing should be called
        guild: 'a',
        disabled: 'Exceeded feed limit',
        disable: jest.fn()
      }]
      jest.spyOn(Guild, 'getAllUniqueFeedLimits')

        .mockResolvedValue(new Map([['a', 3]]))
      await checkLimits.limits(feeds)
      expect(feeds[2].disable).not.toHaveBeenCalledTimes(1)
      expect(feeds[3].disable).not.toHaveBeenCalled()
    })
    it('enables all and disables none if limit is 0', async function () {
      config.get.mockReturnValue({
        feeds: {
          max: 0
        }
      })
      const feeds = [{
        // Enabled
        guild: 'a',
        disabled: undefined,
        disable: jest.fn()
      }, {
        // Enabled
        guild: 'a',
        disabled: undefined,
        disable: jest.fn()
      }, {
        // Enabled, over limi
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn(),
        disable: jest.fn()
      }, {
        // Disabled, enable should be called
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn(),
        disable: jest.fn()
      }, {
        // Disabled, enable should not be called for unrelated reason
        guild: 'a',
        disabled: 'ttt',
        enable: jest.fn(),
        disable: jest.fn()
      }]
      jest.spyOn(Guild, 'getAllUniqueFeedLimits')

        .mockResolvedValue(new Map())
      await checkLimits.limits(feeds)
      expect(feeds[0].disable).not.toHaveBeenCalled()
      expect(feeds[1].disable).not.toHaveBeenCalled()
      expect(feeds[2].enable).toHaveBeenCalledTimes(1)
      expect(feeds[2].disable).not.toHaveBeenCalled()
      expect(feeds[3].enable).toHaveBeenCalledTimes(1)
      expect(feeds[3].disable).not.toHaveBeenCalled()
      expect(feeds[4].enable).not.toHaveBeenCalled()
      expect(feeds[4].disable).not.toHaveBeenCalled()
    })
    it('only calls enable for feeds with \'Exceeded feed limit\' reason', async function () {
      const feeds = [{
        // Disabled, under limit but should not be enabled be limit checks
        guild: 'a',
        disabled: 'Random reason',
        enable: jest.fn()
      }, {
        // Enabled
        guild: 'a',
        disabled: undefined
      }, {
        // Disabled, should be enabled by limit checks
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn()
      }, {
        // Disabled, should not be enabled by limit checks
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn()
      }]
      jest.spyOn(Guild, 'getAllUniqueFeedLimits')

        .mockResolvedValue(new Map([['a', 3]]))
      await checkLimits.limits(feeds)
      expect(feeds[0].enable).not.toHaveBeenCalled()
      expect(feeds[2].enable).toHaveBeenCalled()
      expect(feeds[3].enable).toHaveBeenCalled()
    })
    it('enables the correct ones when intertwined with unrelated disables', async function () {
      const feeds = [{
        // Disabled, unrelated reason - do not enable
        guild: 'a',
        disabled: 'Random reason',
        enable: jest.fn()
      }, {
        // Disabled, unrelated reason - do not enable
        guild: 'a',
        disabled: 'random reasonf',
        enable: jest.fn()
      }, {
        // Disabled, should be enabled by limit checks
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn()
      }, {
        // Disabled, should not be enabled by limit checks
        guild: 'a',
        disabled: 'Exceeded feed limit',
        enable: jest.fn()
      }]
      jest.spyOn(Guild, 'getAllUniqueFeedLimits')

        .mockResolvedValue(new Map())
      await checkLimits.limits(feeds)
      expect(feeds[0].enable).not.toHaveBeenCalled()
      expect(feeds[1].enable).not.toHaveBeenCalled()
      expect(feeds[2].enable).toHaveBeenCalled()
      expect(feeds[3].enable).toHaveBeenCalled()
    })
  })
})

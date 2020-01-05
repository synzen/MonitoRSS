process.env.TEST_ENV = true
const Feed = require('../../../structs/db/Feed.js')
const Supporter = require('../../../structs/db/Supporter.js')
const checkLimits = require('../../../util/maintenance/checkLimits.js')
const config = require('../../../config.js')

jest.mock('../../../config.js')
jest.mock('../../../structs/db/Feed.js')
jest.mock('../../../structs/db/Supporter.js')

config.feeds.max = 2

describe('utils/maintenance/checkLimits', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
    Feed.getAll.mockResolvedValue([])
    Supporter.getFeedLimitsOfGuilds
      .mockResolvedValue(new Map())
  })
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
    await checkLimits(feeds, new Map())
    expect(feeds[1].enable).toHaveBeenCalledTimes(1)
    expect(feeds[1].disable).not.toHaveBeenCalled()
    expect(feeds[2].enable).not.toHaveBeenCalled()
    expect(feeds[2].disable).not.toHaveBeenCalled()
  })
  it('calls disable on enabled feeds for feeds over limit', async function () {
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
    await checkLimits(feeds, new Map())
    expect(feeds[2].disable).toHaveBeenCalledTimes(1)
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
    await checkLimits(feeds, new Map())
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
      enable: jest.fn(),
      disable: jest.fn()
    }, {
      // Enabled, should be disabled since the limit is 2
      guild: 'a',
      disabled: undefined,
      enable: jest.fn(),
      disable: jest.fn()
    }]
    const result = await checkLimits(feeds, new Map())
    expect(result.enabled).toEqual(1)
    expect(result.disabled).toEqual(1)
  })
  it(`uses the supporter limit if available for guild`, async function () {
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
    await checkLimits(feeds, new Map([['a', 3]]))
    expect(feeds[2].disable).not.toHaveBeenCalledTimes(1)
    expect(feeds[3].disable).not.toHaveBeenCalled()
  })
  it(`enables all and disables none if limit is 0`, async function () {
    const oValue = config.feeds.max
    config.feeds.max = 0
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
      // Disabled, nothing should be called
      guild: 'a',
      disabled: 'Exceeded feed limit',
      enable: jest.fn(),
      disable: jest.fn()
    }]
    await checkLimits(feeds, new Map())
    expect(feeds[2].enable).toHaveBeenCalledTimes(1)
    expect(feeds[3].enable).toHaveBeenCalled()
    expect(feeds[0].disable).not.toHaveBeenCalled()
    expect(feeds[1].disable).not.toHaveBeenCalled()
    expect(feeds[2].disable).not.toHaveBeenCalled()
    expect(feeds[3].disable).not.toHaveBeenCalled()
    config.feeds.max = oValue
  })
  it(`only calls enable for feeds with 'Exceeded feed limit' reason`, async function () {
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
      // Disabled, should be enabled by limit checks
      guild: 'a',
      disabled: 'Exceeded feed limit',
      enable: jest.fn()
    }]
    await checkLimits(feeds, new Map([['a', 3]]))
    expect(feeds[0].enable).not.toHaveBeenCalled()
    expect(feeds[2].enable).toHaveBeenCalled()
    expect(feeds[3].enable).not.toHaveBeenCalled()
  })
})

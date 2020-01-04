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
      disabled: true,
      enable: jest.fn(),
      disable: jest.fn()
    }, {
      guild: 'a',
      disabled: true,
      enable: jest.fn(),
      disable: jest.fn()
    }]
    Feed.getAll.mockResolvedValue(feeds)
    await checkLimits()
    expect(feeds[1].enable).toHaveBeenCalledTimes(1)
    expect(feeds[1].disable).not.toHaveBeenCalled()
    expect(feeds[2].enable).not.toHaveBeenCalled()
    expect(feeds[2].disable).not.toHaveBeenCalled()
  })
  it('calls disable on enabled feeds for feeds over limit', async function () {
    const feeds = [{
      // Enabled
      guild: 'a',
      disabled: false
    }, {
      // Enabled
      guild: 'a',
      disabled: false
    }, {
      // Enabled, over limit
      guild: 'a',
      disabled: false,
      disable: jest.fn()
    }, {
      // Disabled, nothing should be called
      guild: 'a',
      disabled: true,
      disable: jest.fn()
    }]
    Feed.getAll.mockResolvedValue(feeds)
    await checkLimits()
    expect(feeds[2].disable).toHaveBeenCalledTimes(1)
    expect(feeds[3].disable).not.toHaveBeenCalled()
  })
  it('calls enable and disable on feeds under and over limits', async function () {
    const feeds = [{
      // Enabled
      guild: 'a',
      disabled: false
    }, {
      // Disabled, should be enabled since it's the 2nd feed
      guild: 'a',
      disabled: true,
      enable: jest.fn(),
      disable: jest.fn()
    }, {
      // Enabled, should be disabled since the limit is 2
      guild: 'a',
      disabled: false,
      enable: jest.fn(),
      disable: jest.fn()
    }]
    Feed.getAll.mockResolvedValue(feeds)
    await checkLimits()
    expect(feeds[1].disable).not.toHaveBeenCalled()
    expect(feeds[1].enable).toHaveBeenCalledTimes(1)
    expect(feeds[2].enable).not.toHaveBeenCalled()
    expect(feeds[2].disable).toHaveBeenCalledTimes(1)
  })
  it('calls returns the number of enabled and disabled', async function () {
    const feeds = [{
      // Enabled
      guild: 'a',
      disabled: false
    }, {
      // Disabled, should be enabled since it's the 2nd feed
      guild: 'a',
      disabled: true,
      enable: jest.fn(),
      disable: jest.fn()
    }, {
      // Enabled, should be disabled since the limit is 2
      guild: 'a',
      disabled: false,
      enable: jest.fn(),
      disable: jest.fn()
    }]
    Feed.getAll.mockResolvedValue(feeds)
    const result = await checkLimits()
    expect(result.enabled).toEqual(1)
    expect(result.disabled).toEqual(1)
  })
})

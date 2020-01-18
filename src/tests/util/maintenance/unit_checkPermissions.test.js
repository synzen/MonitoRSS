process.env.TEST_ENV = true
const checkPermissions = require('../../../util/maintenance/checkPermissions.js')

describe('Unit::util/maintenance/checkPermission', function () {
  const permissionsIn = jest.fn()
  const bot = {
    channels: {
      get: () => ({
        guild: {
          me: {
            permissionsIn
          }
        }
      })
    }
  }
  beforeEach(function () {
    permissionsIn.mockReset()
  })
  it('calls disable for undisabled feed for missing view channel message', async function () {
    const feed = {
      disabled: undefined,
      disable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: []
    }
    permissionsIn.mockReturnValue(new Set(['SEND_MESSAGES', 'EMBED_LINKS']))
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).toHaveBeenCalledTimes(1)
    expect(feed.disable).toHaveBeenCalledWith('Missing permissions VIEW_CHANNEL')
    expect(res).toEqual(true)
  })
  it('calls disable for undisabled feed for missing send messages', async function () {
    const feed = {
      disabled: undefined,
      disable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: []
    }
    permissionsIn.mockReturnValue(new Set(['VIEW_CHANNEL', 'EMBED_LINKS']))
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).toHaveBeenCalledTimes(1)
    expect(feed.disable).toHaveBeenCalledWith('Missing permissions SEND_MESSAGES')
    expect(res).toEqual(true)
  })
  it('calls disable for undisabled feed for missing embed links with embed', async function () {
    const feed = {
      disabled: undefined,
      disable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: [{}]
    }
    permissionsIn.mockReturnValue(new Set(['VIEW_CHANNEL', 'SEND_MESSAGES']))
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).toHaveBeenCalledTimes(1)
    expect(feed.disable).toHaveBeenCalledWith('Missing permissions EMBED_LINKS')
    expect(res).toEqual(true)
  })
  it('does not call disable for undisabled feed for missing embed links with no embed', async function () {
    const feed = {
      disabled: undefined,
      disable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: []
    }
    permissionsIn.mockReturnValue(new Set(['VIEW_CHANNEL', 'SEND_MESSAGES']))
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).not.toHaveBeenCalled()
    expect(res).toEqual(false)
  })
  it('calls disable for undisabled feed for multiple permissions missing', async function () {
    const feed = {
      disabled: undefined,
      disable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: []
    }
    permissionsIn.mockReturnValue(new Set(['EMBED_LINKS']))
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).toHaveBeenCalledTimes(1)
    expect(feed.disable).toHaveBeenCalledWith(`Missing permissions SEND_MESSAGES, VIEW_CHANNEL`)
    expect(res).toEqual(true)
  })
  it('changes the disable reason if one of the permission status changes', async function () {
    const feed = {
      disabled: 'Missing permissions VIEW_CHANNEL',
      disable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: []
    }
    permissionsIn.mockReturnValue(new Set(['EMBED_LINKS']))
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).toHaveBeenCalledTimes(1)
    expect(feed.disable).toHaveBeenCalledWith(`Missing permissions SEND_MESSAGES, VIEW_CHANNEL`)
    expect(res).toEqual(true)
  })
  it('does not call disable if feed is already disabled unrelated to permissions', async function () {
    const feed = {
      disabled: 'hook hok',
      disable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: []
    }
    permissionsIn.mockReturnValue(new Set())
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).not.toHaveBeenCalled()
    expect(res).toEqual(true)
  })
  it('enables the feed if all permissions found', async function () {
    const feed = {
      disabled: 'Missing permissions VIEW_CHANNEL',
      disable: jest.fn(() => Promise.resolve()),
      enable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: []
    }
    permissionsIn.mockReturnValue(new Set(['EMBED_LINKS', 'VIEW_CHANNEL', 'SEND_MESSAGES']))
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).not.toHaveBeenCalled()
    expect(feed.enable).toHaveBeenCalledTimes(1)
    expect(res).toEqual(false)
  })
  it('does not enable the feed if the disable reason is unrelated', async function () {
    const feed = {
      disabled: 'whodat',
      disable: jest.fn(() => Promise.resolve()),
      enable: jest.fn(() => Promise.resolve())
    }
    const format = {
      embeds: []
    }
    permissionsIn.mockReturnValue(new Set(['EMBED_LINKS', 'VIEW_CHANNEL', 'SEND_MESSAGES']))
    const res = await checkPermissions(feed, format, bot)
    expect(feed.disable).not.toHaveBeenCalled()
    expect(feed.enable).not.toHaveBeenCalled()
    expect(res).toEqual(true)
  })
})

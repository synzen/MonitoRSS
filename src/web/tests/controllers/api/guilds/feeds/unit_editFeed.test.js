process.env.TEST_ENV = true
const editFeed = require('../../../../../controllers/api/guilds/feeds/editFeed.js')
const feedServices = require('../../../../../services/feed.js')
const {
  createResponse,
  createNext
} = require('../../../../mocks/express.js')

jest.mock('../../../../../services/feed.js')
jest.mock('../../../../../util/createError.js')
jest.mock('../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/editFeed', function () {
  afterEach(function () {
    feedServices.editFeed.mockReset()
  })
  it('returns 304 if undedited', async function () {
    const req = {
      params: {},
      body: {}
    }
    const end = jest.fn()
    const res = {
      status: jest.fn(() => ({ end }))
    }
    const next = createNext()
    await editFeed(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(304)
    expect(end).toHaveBeenCalledWith()
  })
  it('calls next if the service fails', async function () {
    const req = {
      params: {},
      body: {
        title: 'aegr'
      }
    }
    const res = createResponse()
    const error = new Error('wesadg')
    feedServices.editFeed.mockRejectedValue(error)
    const next = createNext()
    await editFeed(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('returns the edited feed', async function () {
    const req = {
      params: {
        feedID: 'q3ert'
      },
      body: {
        title: 'wt4erg'
      }
    }
    const res = createResponse()
    const editedFeed = {
      a: 1
    }
    feedServices.editFeed.mockResolvedValue(editedFeed)
    const next = createNext()
    await editFeed(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(editedFeed)
  })
  it('calls the service with the right args', async function () {
    const req = {
      params: {
        feedID: 'q3ert'
      },
      body: {
        channel: 'qw2t4erg',
        title: 'wt4erg',
        checkDates: true,
        imgPreviews: '',
        imgLinksExistence: '',
        formatTables: false,
        ncomparisons: ['hello', 'world'],
        text: 'aedgtswrf',
        embeds: [{
          title: 'hi'
        }],
        filters: {
          title: 'hal'
        }
      }
    }
    const res = createResponse()
    const editedFeed = {
      a: 1
    }
    feedServices.editFeed.mockResolvedValue(editedFeed)
    const next = createNext()
    await editFeed(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(feedServices.editFeed)
      .toHaveBeenCalledWith(req.params.feedID, {
        title: req.body.title,
        channel: req.body.channel,
        checkDates: true,
        imgPreviews: undefined,
        imgLinksExistence: undefined,
        formatTables: false,
        text: req.body.text,
        embeds: req.body.embeds,
        filters: req.body.filters,
        ncomparisons: req.body.ncomparisons
      })
  })
})

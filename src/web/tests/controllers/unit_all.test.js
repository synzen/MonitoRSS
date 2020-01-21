const controller = require('../../controllers/all.js')
const htmlConstants = require('../../constants/html.js')

jest.mock('../../constants/html.js')

describe('Unit::controllers/all', function () {
  it('replaces __OG_TITLE__ and __OG_DESCRIPTION__', function () {
    const oIndexFile = htmlConstants.indexFile
    const oMetaTitle = htmlConstants.metaTitle
    const oMetaDescription = htmlConstants.metaDescription
    htmlConstants.indexFile = '__OG_TITLE__heck__OG_DESCRIPTION__'
    htmlConstants.metaTitle = 'title'
    htmlConstants.metaDescription = 'description'
    const send = jest.fn()
    const response = {
      type: jest.fn(() => ({ send }))
    }
    controller({}, response)
    expect(send).toHaveBeenCalledWith('titleheckdescription')
    htmlConstants.indexFile = oIndexFile
    htmlConstants.metaDescription = oMetaDescription
    htmlConstants.metaTitle = oMetaTitle
  })
})

const createRequest = () => ({
  query: {},
  params: {},
  session: {},
  app: {
    get: jest.fn()
  }
})

const createResponse = () => ({
  redirect: jest.fn(),
  json: jest.fn(),
  send: jest.fn(),
  end: jest.fn()
})

const createNext = () => jest.fn()

module.exports = {
  createRequest,
  createResponse,
  createNext
}

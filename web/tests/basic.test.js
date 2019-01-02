/* eslint-env node, jest */
process.env.NODE_ENV = 'test'

const request = require('supertest')
const app = require('../index.js')

describe('/test', function () {
  let expressApp
  beforeAll(function () {
    expressApp = app()
    expressApp.all('*', (req, res, next) => {
      req.session = { hello: 'world!' }
    })
  })
  it('should return 200', function (done) {
    request(expressApp)
      .get('/test')
      .expect(200)
      .end(done)
  })
})

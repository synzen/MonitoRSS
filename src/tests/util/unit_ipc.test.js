const ipc = require('../../util/ipc.js')

describe('Unit::util/ipc.js', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  describe('static send', function () {
    it('sends with the right data', function () {
      const type = 'qawe3t46ry3'
      const data = {
        fo: 'z'
      }
      const expected = {
        _drss: true,
        _loopback: true,
        type,
        data
      }
      const spy = jest.spyOn(process, 'send').mockReturnValue()
      ipc.send(type, data, true)
      expect(spy).toHaveBeenCalledWith(expected)
      spy.mockClear()
      ipc.send(type, data)
      expect(spy).toHaveBeenCalledWith({
        ...expected,
        _loopback: false
      })
    })
  })
  describe('isValid', function () {
    it('returns the correct value', function () {
      expect(ipc.isValid({ fo: 'b' })).toEqual(false)
      expect(ipc.isValid({ _drss: true })).toEqual(true)
      expect(ipc.isValid({ _drss: 1 })).toEqual(false)
    })
  })
  describe('loopback', function () {
    it('returns the correct value', function () {
      expect(ipc.isLoopback({ fo: 'b' })).toEqual(false)
      expect(ipc.isLoopback({ _loopback: true })).toEqual(true)
      expect(ipc.isLoopback({ _loopback: 1 })).toEqual(false)
    })
  })
})

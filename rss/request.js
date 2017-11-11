const needle = require('needle')
const cloudscraper = require('cloudscraper') // For cloudflare

module.exports = function (link, cookies, feedparser, callback) {
  const options = {
    timeout: 27000,
    read_timeout: 24000,
    follow_max: 5,
    follow_set_cookies: true,
    rejectUnauthorized: true,
    headers: {'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36'},
    decode: false
  }

  if (cookies) options.cookies = cookies

  ;(function connectToLink () {
    const request = needle.get(link, options)

    request.on('header', function (statusCode, headers) {
      if (statusCode === 200) {
        callback(null)
        if (feedparser) request.pipe(feedparser)
      } else if (headers.server && headers.server.includes('cloudflare')) {
        cloudscraper.get(link, function (err, res, body) { // For cloudflare
          if (err || res.statusCode !== 200) return callback(err || new Error(`Bad status code (${res.statusCode})` + `${cookies ? ' (Cookies found)' : ''}`))
          callback(null)
          if (!feedparser) return
          let Readable = require('stream').Readable
          let feedStream = new Readable()
          feedStream.push(body)
          feedStream.push(null)
          feedStream.pipe(feedparser)
        })
      } else request.emit('err', new Error(`Bad status code (${statusCode})`))
    })

    request.on('err', function (err) {
      callback(err + `${cookies ? ' (Cookies found)' : ''}`)
    })
  })()
}

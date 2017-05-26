const needle = require('needle')
const cloudscraper = require('cloudscraper') // For cloudflare

module.exports = function (link, cookies, feedparser, callback) {
  var options = {
    timeout: 10000,
    read_timeout: 8000,
    follow_max: 5,
    follow_set_cookies: true,
    rejectUnauthorized: true
  }

  if (cookies) options.cookies = cookies

  ;(function connectToLink () {
    const request = needle.get(link, options)

    request.on('header', function (statusCode, headers) {
      if (statusCode === 200) {
        if (feedparser) request.pipe(feedparser)
        else callback(false)
      } else if (headers.server && headers.server.includes('cloudflare')) {
        cloudscraper.get(link, function (err, res, body) { // For cloudflare
          if (err || res.statusCode !== 200) return callback(err || new Error(`Bad status code (${res.statusCode})` + `${cookies ? ' (Cookies found)' : ''}`))
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

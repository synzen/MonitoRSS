const FetchStream = require('fetch').FetchStream
const cloudscraper = require('cloudscraper') // For cloudflare

module.exports = function(link, cookies, feedparser, callback) {
  let attempts = 0;

  let options = {timeout:10000};
  if (cookies) options.cookies = cookies;

  (function requestStream() {
    const request = new FetchStream(link, options)

    request.on('error', function(err) {
      if (attempts < 2 && err.message && !err.message.startsWith('Bad status code (4')) {
        attempts++;
        return requestStream();
      }
      else return callback(err + `${cookies ? ' (Cookies found)' : ''}`);
    })

    request.on('meta', function (meta) {
      if (meta.status !== 200) {
        if (meta.responseHeaders.server && meta.responseHeaders.server.includes('cloudflare')) {
          cloudscraper.get(link, function(err, res, body) { // For cloudflare
            if (err) return callback(err);
            let Readable = require('stream').Readable
            let feedStream = new Readable
            feedStream.push(body)
            feedStream.push(null)
            feedStream.pipe(feedparser)
          })
        }
        else return this.emit('error', new Error(`Bad status code (${meta.status})`));
      }
      else this.pipe(feedparser)
    })
  })()
}

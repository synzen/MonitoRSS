const got = require('got')
const cloudscraper = require('cloudscraper') // For cloudflare

module.exports = function(link, cookies, feedparser, callback) {
  let attempts = 0;

  let options = {retries: 2, timeout: 5000};
  if (cookies) {
    options.headers = {};
    options.headers.cookie = cookies;
  }

 const request = got.stream(link, options)

 request.on('response', function(res) {
   if (res.statusCode == 200) request.pipe(feedparser);
 })

 request.on('error', function(err, body, resp) {
   if (resp && resp.headers && resp.headers.server && resp.headers.server.includes('cloudflare')) {
     cloudscraper.get(link, function(err, res, body) { // For cloudflare
       if (err) return callback(err + `${cookies ? ' (Cookies found)' : ''}`);
       let Readable = require('stream').Readable
       let feedStream = new Readable
       feedStream.push(body)
       feedStream.push(null)
       feedStream.pipe(feedparser)
     })
   }
   else callback(err + `${cookies ? ' (Cookies found)' : ''}`);
 })
}

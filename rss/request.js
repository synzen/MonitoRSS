const got = require('got')
const cloudscraper = require('cloudscraper') // For cloudflare

module.exports = function(link, cookies, feedparser, callback) {

  let options = {retries: 3, timeout: 10000}
  if (cookies) options.headers = {cookie: cookies};

 const request = got.stream(link, options)

 request.on('response', function(res) {
   if (res.statusCode == 200) {
     if (feedparser) request.pipe(feedparser);
     else callback(false);
   }
 })

 request.on('error', function(err, body, resp) {
   if (resp && resp.headers && resp.headers.server && resp.headers.server.includes('cloudflare')) {
     cloudscraper.get(link, function(err, res, body) { // For cloudflare
       if (err || res.statusCode != 200) return callback(err ? err : `Bad status code (${res.statusCode})` + `${cookies ? ' (Cookies found)' : ''}`);
       if (!feedparser) return;
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

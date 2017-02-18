const FetchStream = require('fetch').FetchStream; // for fetching the feed

module.exports = function (link, feedparser, callback) {
  var attempts = 0;

  (function requestStream() {
    var request = new FetchStream(link, {timeout: 15000})

    request.on('error', function (err) {
      if (attempts < 4) {
        attempts++;
        return requestStream();
      }
      else {
        console.log(`RSS Request ${err} for ${link}, skipping...`);
        return callback(err);
      }
    })

    request.on('meta', function (meta) {
      if (meta.status !== 200) return this.emit('error', new Error(`Bad status code (${meta.status})`))
      this.pipe(feedparser);
    })
  })()
}

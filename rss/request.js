const FetchStream = require('fetch').FetchStream

module.exports = function (link, feedparser, callback) {
  let attempts = 0;

  (function requestStream() {
    const request = new FetchStream(link, {timeout: 15000})

    request.on('error', function(err) {
      if (attempts < 4) {
        attempts++;
        return requestStream();
      }
      else {
        feedparser.removeAllListeners('end');
        return callback(err);
      }
    })

    request.on('meta', function (meta) {
      if (meta.status !== 200) return this.emit('error', new Error(`Bad status code (${meta.status})`));
      this.pipe(feedparser)
    })
  })()
}

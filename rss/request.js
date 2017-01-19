const request = require('request'); // for fetching the feed
const sqlCmds = require('./sql/commands.js')

module.exports = function (link, feedparser, con, callback) {
  var attempts = 0;

  (function requestStream() {
    const req = request(link, function (error, response) {
      // if (error || response.statusCode !== 200)
      //   console.log(`RSS Request Error: Problem occured while requesting from "${link}"`);
    });

    req.on('error', function (error) {
      console.log(`RSS Request Error: ${error} for request from ${link}.  Reconnection attempt #${attempts+1}`)
      if (attempts < 10) {
        attempts++;
        requestStream();
      }
      else {
        console.log(`RSS Request Error: Unable to reconnect. Skipping ${link}.`);
        callback();
      }
    });

    req.on('response', function (res) {
      var stream = this;

      if (res.statusCode !== 200) {
        this.emit('error', new Error(`Bad status code.`));
      }
      else {
        if (attempts > 0) console.log(`RSS Request Success on attempt ${attempts+1}`);
        stream.pipe(feedparser);
      }

    });
  })()
}

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
      if (attempts < 4) {
        attempts++;
        setTimeout(requestStream, 1500);
      }
      else {
        console.log(`RSS Request Error: Unable to connect to ${link}, skipping...`);
        callback();
      }
    });

    req.on('response', function (res) {
      var stream = this;

      if (res.statusCode !== 200) {
        this.emit('error', new Error(`Bad status code.`));
      }
      else {
        if (attempts > 0) console.log(`RSS Request: Successful connection to ${link} on attempt ${attempts+1}`);
        stream.pipe(feedparser);
      }

    });
  })()
}

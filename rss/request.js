const request = require('req-fast'); // for fetching the feed
const sqlCmds = require('./sql/commands.js')

module.exports = function (link, feedparser, con, callback) {
  var attempts = 0;
  
  (function requestStream() {
    request(link, function (error, response) {
      if (error || response === undefined || response.statusCode !== 200) {
        if (attempts < 4) {
          attempts++;
          return requestStream();
        }
        else {
          console.log(`RSS Request Error: Unable to connect to ${link}, skipping...`);
          return callback();
        }
      }
      else if (attempts > 0) {
        console.log(`RSS Request: Successful connection to ${link} on attempt ${attempts+1}`);
      }
    })
    .pipe(feedparser)

  })()

}

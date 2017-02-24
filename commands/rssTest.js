const getRSS = require('../rss/rss.js')
const checkValidConfig = require('../util/configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')

module.exports = function (message, rssIndex) {
  message.channel.sendMessage(`Grabbing a random feed article...`)
  .then(grabMsg => {
    var con = sqlConnect(getTestMsg)
    function getTestMsg() {
      getRSS(con, message.channel, rssIndex, grabMsg, function (err) {
        if (err) channel.sendMessage('Unable to get test feed. Could not connect to feed link.');
        sqlCmds.end(con, function(err) {
          if (err) throw err;
        })
        // grabbing.then(m => m.delete())
      });
    }
  })
  .catch(err => console.log(`Promise Warning: rssTest 1: ${err}`))

}

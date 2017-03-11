const getRSS = require('../rss/rss.js')
const getIndex = require('./util/printFeeds.js')
const checkValidConfig = require('../util/configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')

module.exports = function(bot, message, command) {

  getIndex(bot, message, command, function(rssName) {
    message.channel.sendMessage(`Grabbing a random feed article...`)
    .then(grabMsg => {
      // Replicate the RSS process for a test article
      const con = sqlConnect(getTestMsg)
      function getTestMsg() {
        getRSS(con, message.channel, rssName, grabMsg, function (err) {
          if (err) {
            let channelErrMsg = '';
            switch(err.type) {
              case 'request':
                channelErrMsg = 'Unable to connect to feed link';
                break;
              case 'feedparser':
                channelErrMsg = 'Invalid feed';
                break;
              default:
                channelErrMsg = 'No reason available';
            }
            // Reserve err.content for console logs, which are more verbose
            console.log(`RSS Warning: Unable to add ${rssLink}. Reason: ${err.content}`);
            grabMsg.edit(`Unable to grab random feed article. Reason: ${channelErrMsg}.`);
          }

          sqlCmds.end(con, function(err) {
            if (err) throw err;
          })
        });
      }
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could initiate random feed grab for test (${err})`))
  })

}

const getRSS = require('../rss/rss.js')
const getIndex = require('./util/printFeeds.js')
const checkValidConfig = require('../util/configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const sendToDiscord = require('../util/sendToDiscord.js')

module.exports = function(bot, message, command) {

  getIndex(bot, message, command, function(rssName) {
    message.channel.sendMessage(`Grabbing a random feed article...`)
    .then(function(grabMsg) {
      // Replicate the RSS process for a test article
      const con = sqlConnect(getTestMsg)
      function getTestMsg() {
        getRSS(con, message.channel, rssName, grabMsg, function(err, articles) {
          if (err) {
            let channelErrMsg = '';
            switch(err.type) {
              case 'request':
                channelErrMsg = 'Unable to connect to feed link';
                break;
              case 'feedparser':
                channelErrMsg = 'Invalid feed';
                break;
              case 'database':
                channelErrMsg = 'Internal database error. Please try again';
                break;
              default:
                channelErrMsg = 'No reason available';
            }
            console.log(`RSS Warning: Unable to send test article '${rssLink}'. Reason: ${err.content}`); // Reserve err.content for console logs, which are more verbose
            return grabMsg.edit(`Unable to grab random feed article. Reason: ${channelErrMsg}.`);
          }
          sendToDiscord(rssName, message.channel, articles[0], function(err) {
            if (err) console.log(err);
          }, grabMsg); // Last parameter indicating a test message
          sqlCmds.end(con, function(err) {
            if (err) throw err;
          })
        });
      }
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could initiate random feed grab for test (${err})`))
  })

}

const request = require('req-fast')
const initializeRSS = require('../rss/initialize.js')
const sqlConnect = require('../rss/sql/connect.js')
const sqlCmds = require('../rss/sql/commands.js')
const rssConfig = require('../config.json')

module.exports = function (bot, message) {

  var rssList = []

  try {rssList = require(`../sources/${message.guild.id}.json`).sources;}
  catch (e) {}

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel,10))) {
      if (message.channel.name == channel) return true;
      else return false;
    }
    else {
      if (message.channel.id == channel) return true;
      else return false;
    }
  }

  let content = message.content.split(" ");
  if (content.length == 1) return;

  let rssLink = content[1].trim()
  if (!rssLink.startsWith("http")) return message.channel.sendMessage("Unable to add feed. Make sure it is a link, and there are no odd characters before your feed link.")
  else if (rssList.length >= rssConfig.maxFeeds && rssConfig.maxFeeds !== 0)  {
    console.log(`RSS Info: (${message.guild.id}, ${message.guild.name}) => Unable to add feed ${rssLink} due to limit of ${rssConfig.maxFeeds} feeds.`);
    return message.channel.sendMessage(`Unable to add feed. The server has reached the limit of: \`${rssConfig.maxFeeds}\` feeds.`);
  }

  var verify = message.channel.sendMessage("Verifying link...")

  verify.then(function (verifyMsg) {
    var attempts = 0;

    (function checkValidLink() {
      request(rssLink, function (error, response, body) {
        if (!error && response.statusCode == 200){
          for (var x in rssList) {
            if ( rssList[x].link == rssLink && isCurrentChannel(rssList[x].channel) ) {
              return verifyMsg.edit("Unable to add feed because it already exists for this channel.");
            }
          }
          var con = sqlConnect(init);
          function init() {
            initializeRSS(con, verifyMsg, rssLink, message.channel, function() {
              sqlCmds.end(con, function(err) {
                if (err) throw err;
              });
            });
          }
        }
        else {
          if (attempts < 2) {
            attempts++;
            setTimeout(checkValidLink, 500);
          }
          else {
            console.log(`RSS Info: (${message.guild.id}, ${message.guild.name}) => Unable to add feed ${rssLink} due to invalid response.`)
            return verifyMsg.edit(`Unable to verify feed, could not connect to <${rssLink}>.`);
          }
        }
      });
    })()

  })
}

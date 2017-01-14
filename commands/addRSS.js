const request = require('request')
const initializeRSS = require('../rss/initialize.js')
const sqlConnect = require('../rss/sql/connect.js')
const sqlCmds = require('../rss/sql/commands.js')
const fs = require('fs')

module.exports = function (bot, message) {
  var rssConfig = require('../config.json')

  var rssList = []
  if (fs.existsSync(`./sources/${message.guild.id}.json`)) rssList = require(`../sources/${message.guild.id}`).sources

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
  if (!content[1].startsWith("http")) return message.channel.sendMessage("Unable to add feed. Make sure there are no odd characters before your feed link (such as new lines).")
  message.channel.startTyping()

  request(content[1], (error, response, body) => {

    if (!error && response.statusCode == 200){

      for (var x in rssList) {
        if ( rssList[x].link == content[1] && isCurrentChannel(rssList[x].channel) ) {
          message.channel.stopTyping();
          return message.channel.sendMessage("This feed already exists for this channel.");
        }
      }


      if (rssConfig.maxFeeds == 0 || rssList.length < rssConfig.maxFeeds) {
        var con = sqlConnect(init);
        function init() {
          initializeRSS(con, content[1], message.channel, function() {
            sqlCmds.end(con, function(err) {
              if (err) throw err;
              console.log("RSS Info: Successfully added new feed.")
            });
          });
        }
      }
      else {
        message.channel.stopTyping();
        return message.channel.sendMessage(`Unable to add feed. The server has reached the limit of: \`${rssConfig.maxFeeds}\` feeds.`)
      }
    }

    else {
      return message.channel.sendMessage("That is an invalid feed link.");
      message.channel.stopTyping();
    }

  });

}

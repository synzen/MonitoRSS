const channelTracker = require('../util/channelTracker.js')
const initializeRSS = require('../rss/initialize.js')
const sqlConnect = require('../rss/sql/connect.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')

module.exports = function (bot, message) {

  var rssList = []
  var maxFeedsAllowed = (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds

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
  if (!rssLink.startsWith("http")) return message.channel.sendMessage("Unable to add feed. Make sure it is a link, and there are no odd characters before your feed link.").catch(err => console.log(`Promise Warning: rssAdd 1: ${err}`));
  else if (rssList.length >= maxFeedsAllowed && maxFeedsAllowed != 0)  {
    console.log(`RSS Info: (${message.guild.id}, ${message.guild.name}) => Unable to add feed ${rssLink} due to limit of ${config.feedSettings.maxFeeds} feeds.`);
    return message.channel.sendMessage(`Unable to add feed. The server has reached the limit of: \`${config.feedSettings.maxFeeds}\` feeds.`).catch(err => console.log(`Promise Warning: rssAdd 2: ${err}`));
  }

  var verify = message.channel.sendMessage("Verifying link...").catch(err => console.log(`Promise Warning: rssAdd 3: ${err}`))

  verify.then(function (verifyMsg) {
    channelTracker.addCollector(message.channel.id);

    for (var x in rssList) {
      if (rssList[x].link == rssLink && isCurrentChannel(rssList[x].channel)) {
        channelTracker.removeCollector(message.channel.id);
        return verifyMsg.edit("Unable to add feed because it already exists for this channel.").catch(err => console.log(`Promise Warning: rssAdd 4: ${err}`));
      }
    }

    var con = sqlConnect(init);

    function init() {
      initializeRSS(con, verifyMsg, rssLink, message.channel, function(err) {
        channelTracker.removeCollector(message.channel.id)
        if (err) return verifyMsg.edit(err);
        console.log("RSS Info: Successfully added new feed.")
        verifyMsg.edit(`Successfully verified and added <${rssLink}> for this channel.`).catch(err => console.log(`Promise Warning: rssAdd 5: ${err}`))
        sqlCmds.end(con, function(err) {
          if (err) throw err;
        });
      });
    }

  })
}

const channelTracker = require('../util/channelTracker.js')
const initializeRSS = require('../rss/initialize.js')
const sqlConnect = require('../rss/sql/connect.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')

module.exports = function (bot, message) {

  var rssList = {}
  try {rssList = require(`../sources/${message.guild.id}.json`).sources;}
  catch (e) {}

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel, 10))) return message.channel.name == channel;
    else if (message.channel.id == channel) return message.channel.id == channel;
  }

  let maxFeedsAllowed = (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds

  // If there is no link after rssadd, return.
  let content = message.content.split(' ');
  if (content.length === 1) return;

  message.channel.sendMessage('Verifying...')
  .then(verifyMsg => {
    let rssLink = content[1].trim()
    if (!rssLink.startsWith('http')) return verifyMsg.edit('Unable to add feed. Make sure it is a link, and there are no odd characters before your feed link.').catch(err => console.log(`Promise Warning: rssAdd 1: ${err}`));
    else if (rssList.size() >= maxFeedsAllowed && maxFeedsAllowed != 0)  {
      console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Unable to add feed ${rssLink} due to limit of ${config.feedSettings.maxFeeds} feeds.`);
      return verifyMsg.edit(`Unable to add feed. The server has reached the limit of: \`${config.feedSettings.maxFeeds}\` feeds.`).catch(err => console.log(`Promise Warning: rssAdd 2: ${err}`));
    }


    channelTracker.addCollector(message.channel.id);

    for (var x in rssList) {
      if (rssList[x].link == rssLink && isCurrentChannel(rssList[x].channel)) {
        channelTracker.removeCollector(message.channel.id);
        return verifyMsg.edit('Unable to add feed because it already exists for this channel.').catch(err => console.log(`Promise Warning: rssAdd 4: ${err}`));
      }
    }

    var con = sqlConnect(init);

    function init() {
      initializeRSS(con, rssLink, message.channel, function(err) {
        channelTracker.removeCollector(message.channel.id)
        if (err) {
          let channelErrMsg = '';
          switch(err.type) {
            case 'request':
              channelErrMsg = 'Unable to connect to feed link';
              break;
            case 'feedparser':
              channelErrMsg = 'Invalid feed';
              break;
            case 'initialization':
              channelErrMsg = 'No meta link available, most likely due to no existing articles';
              break;
            default:
              channelErrMsg = 'No reason available';
          }
          // Reserve err.content for console logs, which are more verbose
          console.log(`Commands Warning: Unable to add ${rssLink}. Reason: ${err.content}`);
          return verifyMsg.edit(`Unable to add feed. Reason: ${channelErrMsg}.`);
        }
        console.log('Commands Info: Successfully added new feed.')
        verifyMsg.edit(`Successfully verified and added <${rssLink}> for this channel.`).catch(err => console.log(`Promise Warning: rssAdd 5: ${err}`))
        sqlCmds.end(con, function(err) {
          if (err) throw err;
        });
      });
    }
  }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not begin feed addition validation. (${err})`))
}

const channelTracker = require('../util/channelTracker.js')
const initializeRSS = require('../rss/initialize.js')
const sqlConnect = require('../rss/sql/connect.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')
const currentGuilds = require('../util/fetchInterval.js').currentGuilds

module.exports = function (bot, message) {

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel, 10))) return message.channel.name == channel;
    else if (message.channel.id == channel) return message.channel.id == channel;
  }

  let guildRss = currentGuilds.get(message.guild.id)
  const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
  const maxFeedsAllowed = (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds

  if (message.content.split(' ').length === 1) return; // If there is no link after rssadd, return.

  const content = message.content.split(' ')

  message.channel.sendMessage('Verifying...')
  .then(function(verifyMsg) {
    const rssLink = content[1].trim()
    if (!rssLink.startsWith('http')) return verifyMsg.edit('Unable to add feed. Make sure it is a valid link with no odd characters.').catch(err => console.log(`Promise Warning: rssAdd 1: ${err}`));
    else if (rssList.size() >= maxFeedsAllowed && maxFeedsAllowed != 0)  {
      console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Unable to add feed ${rssLink} due to limit of ${config.feedSettings.maxFeeds} feeds.`);
      return verifyMsg.edit(`Unable to add feed. The server has reached the limit of: \`${config.feedSettings.maxFeeds}\` feeds.`).catch(err => console.log(`Promise Warning: rssAdd 2: ${err}`));
    }

    channelTracker.addCollector(message.channel.id);

    for (var x in rssList) {
      if (rssList[x].link === rssLink && isCurrentChannel(rssList[x].channel)) {
        channelTracker.removeCollector(message.channel.id);
        return verifyMsg.edit('Unable to add feed because it already exists for this channel.').catch(err => console.log(`Promise Warning: rssAdd 4: ${err}`));
      }
    }

    const con = sqlConnect(init);

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
            default:
              channelErrMsg = 'No reason available';
          }
          // Reserve err.content for console logs, which are more verbose
          console.log(`Commands Warning: Unable to add ${rssLink}. (${err.content})`);
          return verifyMsg.edit(`Unable to add feed. Reason: ${channelErrMsg}.`);
        }
        console.log(`Commands Info: Successfully added ${rssLink}.`)
        verifyMsg.edit(`Successfully verified and added <${rssLink}> for this channel.`).catch(err => console.log(`Promise Warning: rssAdd 5: ${err}`))
        sqlCmds.end(con, function(err) {
          if (err) throw err;
        });
      });
    }
  }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not begin feed addition validation. (${err})`))
}

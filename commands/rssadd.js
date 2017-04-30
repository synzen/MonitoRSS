const channelTracker = require('../util/channelTracker.js')
const initializeRSS = require('../rss/initialize.js')
const sqlConnect = require('../rss/sql/connect.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')
const currentGuilds = require('../util/guildStorage.js').currentGuilds

module.exports = function (bot, message) {

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel, 10))) return message.channel.name == channel;
    else if (message.channel.id == channel) return message.channel.id == channel;
  }

  const guildRss = (currentGuilds.has(message.guild.id)) ? currentGuilds.get(message.guild.id) : {}
  const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
  let maxFeedsAllowed = (guildRss.limitOverride != null) ? guildRss.limitOverride : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds
  if (maxFeedsAllowed === 0) maxFeedsAllowed = 'Unlimited';

  if (message.content.split(' ').length === 1) return message.channel.sendMessage(`The correct syntax is \`${config.botSettings.prefix}rssadd <link>\`.`).then(m => m.delete(3000)).catch(err => console.log(`Promise Warning rssAdd 0: ${err}`)); // If there is no link after rssadd, return.

  let linkList = message.content.split(' ')
  linkList.shift()
  linkList = linkList.join(' ').split(',')

  for (var p = linkList.length - 1; p >= 0; p--) { // Sanitize the links
    linkList[p] = linkList[p].trim();
    if (!linkList[p]) linkList.splice(p, 1);
  }

  const passedLinks = []
  const failedLinks = {}
  const totalLinks = linkList.length

  channelTracker.addCollector(message.channel.id);

  function finishLinkList(verifyMsg) {
    let msg = ''
    if (passedLinks.length > 0) {
      let successBox = 'The following feed(s) have been successfully added:\n```\n';
      for (var index in passedLinks) {
        successBox += `\n* ${passedLinks[index]}`;
      }
      msg += successBox + '\n```\n\n';
    }
    if (failedLinks.size() > 0) {
      let failBox = 'The following feed(s) could not be added:\n```\n';
      let count = 1;
      for (var link in failedLinks) {
        failBox += `\n\n* ${link}\nReason: ${failedLinks[link]}`;
      }
      msg += failBox + '\n```'
    }

    channelTracker.removeCollector(message.channel.id)
    verifyMsg.edit(msg).catch(err => console.log(`Promise Warning rssAdd 1: ${err}`))
  }

  message.channel.sendMessage('Processing...')
  .then(function(verifyMsg) {

    (function processLink(linkIndex) {

      const linkItem = linkList[linkIndex].split(' ');
      const rssLink = linkItem[0];
      if (!rssLink.startsWith('http')) {
        failedLinks[rssLink] = 'Invalid/improperly-formatted link.';
        if (linkIndex + 1 < totalLinks) return processLink(linkIndex + 1);
        else return finishLinkList(verifyMsg);
      }
      else if (maxFeedsAllowed !== 'Unlimited' && rssList.size() >= maxFeedsAllowed) {
        console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Unable to add feed ${rssLink} due to limit of ${maxFeedsAllowed} feeds.`);
        failedLinks[rssLink] = `Maximum feed limit of \`${maxFeedsAllowed}\` has been reached.`;
        if (linkIndex + 1 < totalLinks) return processLink(linkIndex + 1);
        else return finishLinkList(verifyMsg);
      }


      for (var x in rssList) {
        if (rssList[x].link === rssLink && isCurrentChannel(rssList[x].channel)) {
          failedLinks[rssLink] = 'Already exists for this channel.';
          if (linkIndex + 1 < totalLinks) return processLink(linkIndex + 1);
          else return finishLinkList(verifyMsg);
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
              case 'database':
                channelErrMsg = 'Internal database error. Please try again';
                break;
              default:
                channelErrMsg = 'No reason available';
            }
            // Reserve err.content for console logs, which are more verbose
            console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Unable to add ${rssLink}. (${err.content}).`);
            failedLinks[rssLink] = channelErrMsg;
          }
          else {
            console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Added ${rssLink}.`)
            passedLinks.push(rssLink)
          }
          sqlCmds.end(con, function(err) {});
          if (linkIndex + 1 < totalLinks) return processLink(linkIndex + 1);
          else return finishLinkList(verifyMsg);
        });
      }
    })(0)

  }).catch(err => {
    console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not begin feed addition validation. (${err})`)
    channelTracker.removeCollector(message.channel.id)
  })
}

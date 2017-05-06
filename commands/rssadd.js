const channelTracker = require('../util/channelTracker.js')
const initializeRSS = require('../rss/initialize.js')
const sqlConnect = require('../rss/sql/connect.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const overriddenGuilds = storage.overriddenGuilds
const cookieAccessors = storage.cookieAccessors

module.exports = function(bot, message) {

  function sanitize(array) {
    for (var p = array.length - 1; p >= 0; p--) { // Sanitize by removing spaces and newlines
      array[p] = array[p].trim();
      if (!array[p]) array.splice(p, 1);
    }

    return array
  }

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel, 10))) return message.channel.name == channel;
    else if (message.channel.id == channel) return message.channel.id == channel;
  }

  const guildRss = (currentGuilds.has(message.guild.id)) ? currentGuilds.get(message.guild.id) : {}
  const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
  let maxFeedsAllowed = overriddenGuilds[message.guild.id] ? overriddenGuilds[message.guild.id] : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds
  if (maxFeedsAllowed === 0) maxFeedsAllowed = 'Unlimited';

  if (message.content.split(' ').length === 1) return message.channel.send(`The correct syntax is \`${config.botSettings.prefix}rssadd <link>\`. Multiple links can be added at once, separated by commas.`).then(m => m.delete(3000)).catch(err => console.log(`Promise Warning rssAdd 0: ${err}`)); // If there is no link after rssadd, return.

  let linkList = message.content.split(' ')
  linkList.shift()
  linkList = linkList.join(' ').split(',')

  linkList = sanitize(linkList)

  const passedLinks = {}
  const failedLinks = {}
  const totalLinks = linkList.length

  channelTracker.addCollector(message.channel.id);

  function finishLinkList(verifyMsg) {
    let msg = ''
    if (passedLinks.size() > 0) {
      let successBox = 'The following feed(s) have been successfully added:\n```\n';
      for (var passedLink in passedLinks) {
        successBox += `\n* ${passedLink}`;
        if (passedLinks[passedLink]) successBox += `\nCookies:\n${passedLinks[passedLink].join('\n')}`;
      }
      msg += successBox + '\n```\n\n';
    }
    if (failedLinks.size() > 0) {
      let failBox = 'The following feed(s) could not be added:\n```\n';
      let count = 1;
      for (var failedLink in failedLinks) {
        failBox += `\n\n* ${failedLink}\nReason: ${failedLinks[failedLink]}`;
      }
      msg += failBox + '\n```'
    }

    channelTracker.removeCollector(message.channel.id)
    verifyMsg.edit(msg).catch(err => console.log(`Promise Warning rssAdd 1: ${err}`))
  }

  message.channel.send('Processing...')
  .then(function(verifyMsg) {

    (function processLink(linkIndex) { // A self-invoking function for each link

      const linkItem = linkList[linkIndex].split(' ');
      const rssLink = linkItem[0]; // One link may consist of the actual link, and its cookies

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
        linkItem.shift()
        let cookieString = linkItem.join(' ')
        var cookies = (cookieString && cookieString.startsWith('[') && cookieString.endsWith(']')) ? sanitize(cookieString.slice(1, cookieString.length - 1).split(';')) : undefined
        var cookiesFound = cookies ? true: false
        if (config.advanced && config.advanced.restrictCookies == true && !cookieAccessors.ids.includes(message.author.id)) cookies = undefined;
        if (cookiesFound && !cookies) var cookieAccess = false;

        initializeRSS(con, rssLink, message.channel, cookies, function(err) {
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
            if (cookiesFound && !cookies) channelErrMsg += ' (Cookies were detected, but missing access for usage)';
            console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Unable to add ${rssLink}. (${err.content})${cookiesFound && !cookies ? ' (Cookies found, access denied)': ''}.`);
            failedLinks[rssLink] = channelErrMsg;
          }
          else {
            console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Added ${rssLink}.`);
            passedLinks[rssLink] = cookies;
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

const getRandomArticle = require('../rss/getArticle.js')
const getIndex = require('./util/printFeeds.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const sendToDiscord = require('../util/sendToDiscord.js')

module.exports = function(bot, message, command) {

  getIndex(bot, message, command, function(rssName) {
    message.channel.send(`Grabbing a random feed article...`)
    .then(function(grabMsg) {

      getRandomArticle(message.guild.id, rssName, false, function(err, article) {
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
            case 'deleted':
              channelErrMsg = 'Feed missing from database'
            default:
              channelErrMsg = 'No reason available';
          }
          console.log(`RSS Warning: Unable to send test article '${err.feed.link}'. Reason: ${err.content}`); // Reserve err.content for console logs, which are more verbose
          return grabMsg.edit(`Unable to grab random feed article. Reason: ${channelErrMsg}.`);
        }
        article.rssName = rssName
        article.discordChannelId = message.channel.id

        sendToDiscord(bot, article, function(err) {
          if (err) console.log(err);
        }, grabMsg); // Last parameter indicating a test message

      });

    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could initiate random feed grab for test (${err})`))
  })

}

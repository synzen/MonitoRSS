const config = require('../config.json')
const translator = require('../rss/translator/translate.js')
const fetchInterval = require('./fetchInterval.js')
const currentGuilds = fetchInterval.currentGuilds

module.exports = function (rssName, channel, article, isTestMessage, callback) {
  const rssList = currentGuilds[channel.guild.id].sources

  // check if any changes to feed article while article cycle was in progress
  if (!process.env.isCmdServer && fetchInterval.changedGuilds[channel.guild.id]) {
    const guildNew = fetchInterval.changedGuilds[channel.guild.id];
    if (!guildNew.sources) {
      console.info(guildNew.sources);
      console.info(guildNew);
      return console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => No sources found in updated file, skipping Discord message sending.`);
    }
    const rssListNew = guildNew.sources;
    let found = false;
    for (let rssNameNew in rssListNew) if (rssNameNew == rssName) found = true;
    if (!found) return console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => Missing source (link: ${rssList[rssName].link}, name: ${rssName}) in updated file, skipping Discord message sending.`);
  }

  let attempts = 1

  const successLog = (isTestMessage) ? `RSS Test Delivery: (${channel.guild.id}, ${channel.guild.name}) => Sent test message for: ${rssList[rssName].link} in channel (${channel.id}, ${channel.name})` : `RSS Delivery: (${channel.guild.id}, ${channel.guild.name}) => Sent message: ${article.link} in channel (${channel.id}, ${channel.name})`
  const failLog = (isTestMessage) ? `RSS Test Delivery Failure: (${channel.guild.id}, ${channel.guild.name}) => channel (${channel.id}, ${channel.name}) for article ${article.link}. ` : `RSS Delivery Failure: (${channel.guild.id}, ${channel.guild.name}) => channel (${channel.id}, ${channel.name}) for article ${article.link}. `
  const message = translator(channel.guild.id, rssList, rssName, article, isTestMessage)

  if (!message) {
    if (config.logging.showUnfiltered === true) console.log(`RSS Delivery: (${channel.guild.id}, ${channel.guild.name}) => '${(article.link) ? article.link : article.title}' did not pass filters and was not sent.`);
    return callback();
  }

  function sendMain () {
    // Main Message: If it contains both an embed and text, or only an embed.
    if (message.embedMsg) {
      function sendCombinedMsg() {
        channel.sendEmbed(message.embedMsg, message.textMsg)
        .then(m => {
          if (isTestMessage) isTestMessage.delete().catch(err => {});
          // console.log(successLog)
          return callback()
        })
        .catch(err => {
          if (attempts === 4) return callback(failLog + `${err}`);
          attempts++
          setTimeout(sendCombinedMsg, 500)
        });
      }
      if (message.textMsg.length > 1950) { // Discord has a character limit of 2000
        console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed article could not be sent for *${rssName}* due to character count >1950. Message is:\n\n `, message.textMsg);
        message.textMsg = `Error: Feed Article could not be sent for *${article.link}* due to character count >1950. This issue has been logged for resolution.`;
        sendCombinedMsg();
      }
      else sendCombinedMsg();
    }

    // Main Message: If it only contains a text message
    else {
      function sendTxtMsg() {
        channel.sendMessage(message.textMsg)
        .then(m => {
          if (isTestMessage) isTestMessage.delete().catch(err => {});
          // console.log(successLog)
          return callback()
        })
        .catch(err => {
          if (attempts === 4) return callback(failLog + `${err}`);
          attempts++
          setTimeout(sendTxtMsg, 500)
        });
      }
      if (message.textMsg.length > 1950) {
        console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed article could not be sent for *${rssList[rssName].name}* due to character count >1950. Message is:\n\n`, message.textMsg);
        return channel.sendMessage(`Error: Feed Article could not be sent for *${article.link}* due to character count >1950. This issue has been logged for resolution.`);
      }
      else if (message.textMsg.length === 0) return channel.sendMessage(`Unable to send empty message for feed article *${article.link}*.`);
      else sendTxtMsg();
    }
  }

  // For test messages only. It will send the test details first, then the Main Message (above).
  if (isTestMessage) {
    function sendTestDetails() {
      channel.sendMessage(message.testDetails)
      .then(m => {
        sendMain()
        return callback()
      })
      .catch(err => {
        if (attempts === 4) return callback(failLog + `${err}`);
        attempts++
        setTimeout(sendTestDetails, 500)
      });
    }
    if (message.testDetails.length > 1950) {
      console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => Test details could not be sent for *${rssList[rssName].name}* due to character count >1950. Test Details are:\n\n`, message.testDetails);
      channel.sendMessage(`Error: Test details could not be sent for *${article.link}* due to character count >1950. This issue has been logged for resolution. Attempting to send configured message next...`);
      sendMain();
    }
    else sendTestDetails();
  }
  else sendMain();

}

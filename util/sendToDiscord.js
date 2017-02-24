const translator = require('../rss/translator/translate.js')
const fetchInterval = require('./fetchInterval.js')

module.exports = function (rssIndex, channel, article, isTestMessage, callback) {
  var guild = require(`../sources/${channel.guild.id}.json`)
  var rssList = guild.sources

  // check if any changes to feed article while article cycle was in progress
  if (!process.env.isCmdServer && fetchInterval.changedGuilds[channel.guild.id]) {
    let guildNew = fetchInterval.changedGuilds[channel.guild.id];
    if (!guildNew.sources) return console.log(`RSS Warning: (${guild.id}, ${guild.name}) => No sources found in updated file, skipping Dscord message sending.`);
    let rssListNew = guildNew.sources;
    let found = false;
    for (var rssIndexNew in rssListNew) if (rssListNew[rssIndexNew].name == rssList[rssIndex].name) found = true;
    if (!found) return console.log(`RSS Warning: (${guild.id}, ${guild.name}) => Missing source (link: ${rssList[rssIndex].link}, name: ${rssList[rssIndex].name}) in updated file, skipping Discord message sending.`);
  }

  var attempts = 1

  if (isTestMessage) {
    var successLog = `RSS Test Delivery: (${guild.id}, ${guild.name}) => Sent test message for: ${rssList[rssIndex].link} in channel (${channel.id}, ${channel.name})`;
    //var errLog = `RSS Test Error: Attempt #${attempts} (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) => Reason: `;
    var failLog = `RSS Test Delivery Failure: (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) for article ${article.link}. Reason: `;
  }
  else {
    var successLog = `RSS Delivery: (${guild.id}, ${guild.name}) => Sent message: ${article.link} in channel (${channel.id}, ${channel.name})`;
    //var errLog = `RSS Delivery Error: Attempt #${attempts} (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) => Reason: `;
    var failLog = `RSS Delivery Failure: (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) for article ${article.link}. Reason: `;
  }

  var message = translator(channel, rssList, rssIndex, article, isTestMessage)

  if (!message) return callback();

  function sendMain () {
    if (message.embedMsg) {
      function sendCombinedMsg() {
        channel.sendEmbed(message.embedMsg, message.textMsg)
        .then(m => {
          if (isTestMessage) isTestMessage.delete().catch(err => {});
          console.log(successLog)
          return callback()
        })
        .catch(err => {
          if (attempts === 4) return callback(failLog + err);
          attempts++
          setTimeout(sendCombinedMsg, 500)
        });
      }
      if (message.textMsg.length > 1950) {
        console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed article could not be sent for *${rssList[rssIndex].name}* due to character count >1950. Message is:\n\n `, message.textMsg);
        message.textMsg = `Error: Feed Article could not be sent for *${article.link}* due to character count >1950. This issue has been logged for resolution.`;
        sendCombinedMsg();
      }
      else sendCombinedMsg();
    }

    else {
      function sendTxtMsg() {
        channel.sendMessage(message.textMsg)
        .then(m => {
          if (isTestMessage) isTestMessage.delete().catch(err => {});
          console.log(successLog)
          return callback()
        })
        .catch(err => {
          if (attempts === 4) return callback(failLog + err);
          attempts++
          setTimeout(sendTxtMsg, 500)
        });
      }
      if (message.textMsg.length > 1950) {
        console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed article could not be sent for *${rssList[rssIndex].name}* due to character count >1950. Message is:\n\n`, message.textMsg);
        return channel.sendMessage(`Error: Feed Article could not be sent for *${article.link}* due to character count >1950. This issue has been logged for resolution.`);
      }
      else if (message.textMsg.length === 0) return channel.sendMessage(`Unable to send empty message for feed article *${article.link}*.`);
      else sendTxtMsg();
    }
  }

  if (isTestMessage) {
    function sendTestDetails() {
      channel.sendMessage(message.testDetails)
      .then(m => {
        sendMain()
        return callback()
      })
      .catch(err => {
        if (attempts === 4) return callback(failLog + err);
        attempts++
        setTimeout(sendTestDetails, 500)
      });
    }
    if (message.testDetails.length > 1950) {
      console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => Test details could not be sent for *${rssList[rssIndex].name}* due to character count >1950. Test Details are:\n\n`, message.testDetails);
      channel.sendMessage(`Error: Test details could not be sent for *${article.link}* due to character count >1950. This issue has been logged for resolution. Attempting to send configured message next...`);
      sendMain();
    }
    else sendTestDetails();
  }
  else sendMain();

}

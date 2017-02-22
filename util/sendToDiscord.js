const translator = require('../rss/translator/translate.js')

module.exports = function (rssIndex, channel, feed, isTestMessage, callback) {
  var guild = require(`../sources/${channel.guild.id}.json`)
  var rssList = guild.sources
  var attempts = 1

  if (isTestMessage) {
    var successLog = `RSS Test Delivery: (${guild.id}, ${guild.name}) => Sent test message for: ${rssList[rssIndex].link} in channel (${channel.id}, ${channel.name})`;
    //var errLog = `RSS Test Error: Attempt #${attempts} (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) => Reason: `;
    var failLog = `RSS Test Delivery Failure: (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) for feed ${feed.link}. Reason: `;
  }
  else {
    var successLog = `RSS Delivery: (${guild.id}, ${guild.name}) => Sent message: ${feed.link} in channel (${channel.id}, ${channel.name})`;
    //var errLog = `RSS Delivery Error: Attempt #${attempts} (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) => Reason: `;
    var failLog = `RSS Delivery Failure: (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) for feed ${feed.link}. Reason: `;
  }

  var message = translator(channel, rssList, rssIndex, feed, isTestMessage)

  if (!message) return callback();

  function sendMain () {
    if (message.embedMsg) {
      (function sendCombinedMsg() {
        channel.sendMessage(message.textMsg,message.embedMsg)
        .then(m => {
          // console.log(successLog)
          return callback()
        })
        .catch(err => {
          if (attempts === 4) return callback(failLog + err);
          attempts++
          //console.log(errLog + err)
          setTimeout(sendCombinedMsg, 500)
        });
      })();
    }

    else {
      (function sendTxtMsg() {
        channel.sendMessage(message.textMsg)
        .then(m => {
          // console.log(successLog)
          return callback()
        })
        .catch(err => {
          if (attempts === 4) return callback(failLog + err);
          attempts++
          //console.log(errLog + err)
          setTimeout(sendTxtMsg, 500)
        });
      })();
    }
  }

  if (isTestMessage) {
    (function sendTestDetails() {
      channel.sendMessage(message.testDetails)
      .then(m => {
        sendMain()
        return callback()
      })
      .catch(err => {
        if (attempts === 4) return callback(failLog + err);
        attempts++
        //console.log(errLog + err)
        setTimeout(sendTestDetails, 500)
      });
    })();
  }
  else sendMain();

}

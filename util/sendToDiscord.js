const translator = require('../rss/translator/translate.js')

module.exports = function (rssIndex, channel, feed, isTestMessage) {
  var guild = require(`../sources/${channel.guild.id}.json`)
  var rssList = guild.sources

  if (isTestMessage) {
    var successLog = `RSS Test Delivery: (${guild.id}, ${guild.name}) => Sent test message for: ${rssList[rssIndex].link} in channel (${channel.id}, ${channel.name})`;
    var errLog = `RSS Test Error: (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) => Reason: `;
  }
  else {
    var successLog = `RSS Delivery: (${guild.id}, ${guild.name}) => Sent message: ${feed.link} in channel (${channel.id}, ${channel.name})`;
    var errLog = `RSS Delivery Error: (${guild.id}, ${guild.name}) => channel (${channel.id}, ${channel.name}) => Reason: `;
  }


  var message = translator(channel, rssList, rssIndex, feed, isTestMessage);

  if (message != null) {
    if (message.embedMsg != null) {
      channel.sendMessage(message.textMsg,message.embedMsg)
      .then(m => console.log(successLog))
      .catch(err => console.log(errLog + err.response.body.message));
    }

    else {
      channel.sendMessage(message.textMsg)
      .then(m => console.log(successLog))
      .catch(err => console.log(errLog + err.response.body.message));
    }
  }

}

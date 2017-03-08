const fileOps = require('../util/fileOps.js')
const getIndex = require('./util/printFeeds.js')
const removeRss = require('../util/removeRss.js')
const config = require('../config.json')

module.exports = function (bot, message, command, callback) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources


  getIndex(bot, message, command, function(rssName) {
    var link = rssList[rssName].link
    var msg = message.channel.sendMessage(`Removing <${link}>...`)
    .then(m => {
      removeRss(message.guild.id, rssName, function () {
        m.edit(`Successfully removed <${link}> from this channel.`).catch(err => `Promise Warning: rssRemove 1a: ${err}`);
      })
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send RSS removal success message (${err})`))
  })
}

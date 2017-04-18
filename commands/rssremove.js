const getIndex = require('./util/printFeeds.js')
const removeRss = require('../util/removeRss.js')
const config = require('../config.json')
const currentGuilds = require('../util/guildStorage.js').currentGuilds

module.exports = function (bot, message, command, callback) {

  getIndex(bot, message, command, function(rssName) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources
    const link = rssList[rssName].link
    message.channel.sendMessage(`Removing <${link}>...`)
    .then(function(removing) {
      removeRss(message.guild.id, rssName, function (link) {
        removing.edit(`Successfully removed <${link}> from this channel.`).catch(err => `Promise Warning: rssRemove 1a: ${err}`);
      })
    })
    .catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send RSS removal success message (${err})`))
  })

}

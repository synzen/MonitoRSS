const getIndex = require('./util/printFeeds.js')
const removeRss = require('../util/removeRss.js')
const config = require('../config.json')
const currentGuilds = require('../util/guildStorage.js').currentGuilds

module.exports = function(bot, message, command) {

  getIndex(bot, message, command, function(rssNameList) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources

    message.channel.sendMessage(`Removing...`)
    .then(function(removing) {

      let removed = 'Successfully removed the following link(s):\n```\n';

      (function remove(index) {

        removeRss(message.guild.id, rssNameList[index], function(link) {
          removed += `\n${link}`;
          if (index + 1 < rssNameList.length) remove(index + 1);
          else removing.edit(removed + '```').then(m => {}).catch(err => `Promise Warning: rssRemove 1a: ${err}`);
        })
      })(0)

    })
    .catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send RSS removing message (${err})`))

  })

}

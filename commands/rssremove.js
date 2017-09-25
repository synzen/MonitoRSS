const chooseFeed = require('./util/chooseFeed.js')
const removeRss = require('../util/removeRss.js')

module.exports = function (bot, message, command) {
  chooseFeed(bot, message, command, function (rssNameList, msgHandler) {
    message.channel.send(`Removing...`)
    .then(function (removing) {
      let removed = 'Successfully removed the following link(s):\n```\n';

      (function remove (index) {
        removeRss(message.guild.id, rssNameList[index], function (link) {
          removed += `\n${link}`
          if (index + 1 < rssNameList.length) remove(index + 1)
          else {
            msgHandler.deleteAll(message.channel)
            removing.edit(removed + '```').then(m => {}).catch(err => `Promise Warning: rssRemove 1a: ${err}`)
          }
        })
      })(0)
    })
    .catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send RSS removing message (${err})`))
  })
}

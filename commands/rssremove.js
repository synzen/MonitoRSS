const removeRss = require('../util/removeFeed.js')
const FeedSelector = require('./util/FeedSelector.js')

module.exports = (bot, message, command) => {
  new FeedSelector(message, null, { command: command }).send(null, async (err, data, msgHandler) => {
    const { rssNameList } = data
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const removing = await message.channel.send(`Removing...`)
      let removed = 'Successfully removed the following link(s):\n```\n';

      (function remove (index) {
        removeRss(message.guild.id, rssNameList[index], (err, link) => {
          if (err) console.log(`Commands Warning: rssremove error:`, err.message || err)
          removed += `\n${link}`
          if (index + 1 < rssNameList.length) remove(index + 1)
          else {
            msgHandler.deleteAll(message.channel)
            removing.edit(removed + '```').then(m => {}).catch(err => console.log(`Commands Warning: rssRemove 1a`, err.message || err))
          }
        })
      })(0)
    } catch (err) {
      console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rssremove:`, err)
    }
  })
}

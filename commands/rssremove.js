const removeFeed = require('../util/removeFeed.js')
const FeedSelector = require('./util/FeedSelector.js')
const log = require('../util/logger.js')

module.exports = (bot, message, command) => {
  new FeedSelector(message, null, { command: command }).send(null, async (err, data, msgHandler) => {
    const { rssNameList } = data
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const removing = await message.channel.send(`Removing...`)
      let removed = 'Successfully removed the following link(s):\n```\n';

      (function remove (index) {
        removeFeed(message.guild.id, rssNameList[index], (err, link) => {
          if (err && err.code !== 26) log.guild.error(`Unable to remove feed ${link}`, message.guild, err)
          removed += `\n${link}`
          if (index + 1 < rssNameList.length) remove(index + 1)
          else {
            msgHandler.deleteAll(message.channel)
            removing.edit(removed + '```').then(m => {}).catch(err => log.command.warning(`rssRemove 1`, message.guild, err))
          }
        })
      })(0)
    } catch (err) {
      log.command.warning(`rssremove`, message.guild, err)
    }
  })
}

const config = require('../config.js')
const dbOps = require('../util/dbOps.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOps.guildRss.get(message.guild.id)
    const feedSelector = new FeedSelector(message, null, { command: command }, guildRss)
    const data = await new MenuUtils.MenuSeries(message, [feedSelector]).start()
    if (!data) return
    const { rssNameList } = data
    const removing = await message.channel.send(`Removing...`)
    const errors = []
    let removed = 'Successfully removed the following link(s):\n```\n'

    for (var i = 0; i < rssNameList.length; ++i) {
      const link = guildRss.sources[rssNameList[i]].link
      try {
        await dbOps.guildRss.removeFeed(guildRss, rssNameList[i])
        removed += `\n${link}`
        log.guild.info(`Removed feed ${link}`, message.guild)
      } catch (err) {
        log.guild.error(`Failed to remove feed ${link}`, message.guild, err)
        errors.push(err)
      }
    }
    if (errors.length > 0) await removing.edit('Unable to remove specified feeds due to internal error.')
    else await removing.edit(`${removed}\`\`\`\n\nAfter completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`)
  } catch (err) {
    log.command.warning(`rssremove`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssremove 1', message.guild, err))
  }
}

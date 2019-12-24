const config = require('../config.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')

module.exports = async (bot, message, command) => {
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feeds = profile ? await profile.getFeeds() : []
    const feedSelector = new FeedSelector(message, null, { command: command, locale: guildLocale }, feeds)
    const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale }).start()
    if (!data) return
    const { feedList } = data
    const removing = await message.channel.send(translate('commands.rssremove.removing'))
    const errors = []
    let removed = translate('commands.rssremove.success') + '\n```\n'
    const shardID = message.client.shard && message.client.shard.count > 0 ? message.client.shard.id : undefined
    for (const feed of feedList) {
      const link = feed.url
      try {
        await feed.remove(shardID)
        removed += `\n${link}`
        log.guild.info(`Removed feed ${link}`, message.guild)
      } catch (err) {
        log.guild.error(`Failed to remove feed ${link}`, message.guild, err, true)
        errors.push(err)
      }
    }
    const prefix = profile.prefix || config.bot.prefix
    if (errors.length > 0) {
      await removing.edit(translate('commands.rssremove.internalError'))
    } else await removing.edit(`${removed}\`\`\`\n\n${translate('generics.backupReminder', { prefix })}`)
  } catch (err) {
    log.command.warning(`rssremove`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssremove 1', message.guild, err))
  }
}

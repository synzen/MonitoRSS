const config = require('../config.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const createLogger = require('../util/logger/create.js')

module.exports = async (message, command) => {
  const profile = await Profile.get(message.guild.id)
  const guildLocale = profile ? profile.locale : undefined
  const translate = Translator.createLocaleTranslator(guildLocale)
  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const feedSelector = new FeedSelector(message, null, { command, locale: guildLocale, multiSelect: true }, feeds)
  const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale }).start()
  if (!data) return
  const { selectedFeeds } = data
  const removing = await message.channel.send(translate('commands.remove.removing'))
  const errors = []
  const log = createLogger(message.guild.shard.id)
  let removed = translate('commands.remove.success') + '\n```\n'
  for (const feed of selectedFeeds) {
    const link = feed.url
    try {
      await feed.delete()
      removed += `\n${link}`
      log.info({
        guild: message.guild
      }, `Removed feed ${link}`)
    } catch (err) {
      log.error({
        error: err,
        guild: message.guild
      }, `Failed to remove feed ${link}`)
      errors.push(err)
    }
  }
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  if (errors.length > 0) {
    await removing.edit(translate('commands.remove.internalError'))
  } else {
    await removing.edit(`${removed}\`\`\`\n\n${translate('generics.backupReminder', { prefix })}`)
  }
}

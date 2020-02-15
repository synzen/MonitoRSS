const log = require('../util/logger.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const config = require('../config.js')

/**
 * @param {string} str 
 */
function getValidInputs (str) {
  const parts = str.split(' ')
  parts.shift()
  const cleanedParts = parts
    .map(p => p.trim())
    .filter((p, index) => p && parts.indexOf(p) === index && p.length > 1 && (p.startsWith('+') || p.startsWith('-')))
  return cleanedParts
}

/**
 * @param {string} str
 */
function getInvalidInputs (str) {
  const parts = str.split(' ')
  parts.shift()
  const cleanedParts = parts
    .map(p => p.trim())
    .filter((p, index) => p && parts.indexOf(p) === index)

  return cleanedParts.filter(s => (!s.startsWith('+') && !s.startsWith('-')) || s.length < 2)
}

module.exports = async (bot, message, command) => {
  try {
    
    const profile = await Profile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
    const translate = Translator.createLocaleTranslator(guildLocale)
    const arr = message.content.split(' ')
    if (arr.length === 1) {
      return await message.channel.send(translate('commands.compare.info', { infoURL: '(no URL available yet)', prefix }))
    }
    const reset = arr[1].trim() === 'reset'
    const list = arr[1].trim() === 'list'
    const validProperties = getValidInputs(message.content)
    const invalids = getInvalidInputs(message.content)
    if (!reset && !list) {
      if (invalids.length > 0 || validProperties.length === 0) {
        const stringified = `\`${invalids.join('`,`')}\``
        return await message.channel.send(translate('commands.compare.invalid', { errors: stringified }))
      }
      // Temporary check 
      if (validProperties.length !== 1 || validProperties[0] !== '-title') {
        return await message.channel.send(translate('commands.compare.onlyTitle'))
      }
    }
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const feedSelector = new FeedSelector(message, undefined, { command }, feeds)
    const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale }).start()
    if (!data) return
    const feed = data.feed
    if (list) {
      const nvalues = feed.ncomparisons.map(v => `-${v}`)
      const pvalues = feed.pcomparisons.map(v => `+${v}`)
      const values = nvalues.concat(pvalues)
      if (values.length === 0) {
        return await message.channel.send(translate('commands.compare.listNone', { url: feed.url }))
      }
      const str = values.length > 0 ? `\`${values.join('`,`')}\`` : ''
      return await message.channel.send(translate('commands.compare.list', { values: str, url: feed.url }))
    }
    if (reset) {
      feed.ncomparisons = []
      await feed.save()
      await message.channel.send(translate('commands.compare.reset', { url: feed.url }))
    } else {
      feed.ncomparisons = ['title']
      await feed.save()
      const str = `\`${validProperties.join('`\n`')}\``
      await message.channel.send(translate('commands.compare.success', { added: str, url: feed.url }))
    }
  } catch (err) {
    log.command.warning(`rsscompare`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsscompare 1', message.guild, err))
  }
}

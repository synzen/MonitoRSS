const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const runWithFeedsProfile = require('./prompts/runner/run.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

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

module.exports = async (message, command) => {
  const profile = await Profile.get(message.guild.id)
  const guildLocale = profile ? profile.locale : undefined
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const translate = Translator.createLocaleTranslator(guildLocale)
  const arr = message.content.split(' ')
  if (arr.length === 1) {
    return message.channel.send(translate('commands.compare.info', { infoURL: '(no URL available yet)', prefix }))
  }
  const reset = arr[1].trim() === 'reset'
  const list = arr[1].trim() === 'list'
  const validProperties = getValidInputs(message.content)
  const invalids = getInvalidInputs(message.content)
  if (!reset && !list) {
    if (invalids.length > 0 || validProperties.length === 0) {
      const stringified = `\`${invalids.join('`,`')}\``
      return message.channel.send(translate('commands.compare.invalid', { errors: stringified }))
    }
    // Temporary check
    if (validProperties.length !== 1 || validProperties[0] !== '-title') {
      return message.channel.send(translate('commands.compare.onlyTitle'))
    }
  }
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const { selectedFeed: feed } = await runWithFeedsProfile(selectFeedNode, message)
  if (!feed) {
    return
  }
  if (list) {
    const nvalues = feed.ncomparisons.map(v => `-${v}`)
    const pvalues = feed.pcomparisons.map(v => `+${v}`)
    const values = nvalues.concat(pvalues)
    if (values.length === 0) {
      return message.channel.send(translate('commands.compare.listNone', { url: feed.url }))
    }
    const str = values.length > 0 ? `\`${values.join('`,`')}\`` : ''
    return message.channel.send(translate('commands.compare.list', { values: str, url: feed.url }))
  }

  const log = createLogger(message.guild.shard.id)
  if (reset) {
    feed.ncomparisons = []
    await feed.save()
    await message.channel.send(translate('commands.compare.reset', { url: feed.url }))
    log.info({
      guild: message.guild
    }, 'Comparisons have been reset')
  } else {
    feed.ncomparisons = ['title']
    await feed.save()
    const str = `\`${validProperties.join('`\n`')}\``
    await message.channel.send(translate('commands.compare.success', { added: str, url: feed.url }))
    log.info({
      guild: message.guild
    }, `Comparisons have set ${JSON.stringify(feed.ncomparisons)}`)
  }
}

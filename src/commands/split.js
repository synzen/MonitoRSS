const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
function escapeBackticks (str) {
  return str.replace('`', '​`') // Replace backticks with zero-width space and backtick to escape
}

const defSplitCharStr = translate => translate('commands.split.defaultIsValue', { value: `\`\\n\` (${translate('commands.split.newLine')})` })
const defPrependCharStr = translate => translate('commands.split.defaultIsNothing')
const defAppendCharStr = defPrependCharStr
const defMaxLenStr = translate => translate('commands.split.defaultIsValue', { value: '1950' })

async function feedSelectorFn (m, data) {
  const { feed, translate } = data
  const splitOptions = feed.split // Show toggle if it is disabled

  const nextMenu = new MenuUtils.Menu(m, splitOptions ? selectSetting : enable)
    .setAuthor(translate('commands.split.messageSplittingOptions'))
    .setDescription(translate('commands.split.description', {
      title: feed.title,
      link: feed.url,
      currently: splitOptions ? translate('generics.enabledLower') : translate('generics.disabledLower')
    }))

  const currentSplitChar = splitOptions && splitOptions.char ? splitOptions.char : ''
  const currentSplitPrepend = splitOptions && splitOptions.prepend ? splitOptions.prepend : ''
  const currentSplitAppend = splitOptions && splitOptions.append ? splitOptions.append : ''
  const currentSplitLength = splitOptions && splitOptions.maxLength ? splitOptions.maxLength : ''

  if (!splitOptions) {
    nextMenu.addOption(translate('commands.split.optionEnable'), translate('commands.split.optionEnableDescription'))
  } else {
    const curSplitCharStr = translate('commands.split.currentlySetTo', { value: escapeBackticks(currentSplitChar) })
    const curPrependCharStr = translate('commands.split.currentlySetTo', { value: escapeBackticks(currentSplitPrepend) })
    const curAppendCharStr = translate('commands.split.currentlySetTo', { value: escapeBackticks(currentSplitAppend) })
    const curMaxLenStr = translate('commands.split.currentlySetTo', { value: currentSplitLength })

    nextMenu
      .addOption(translate('commands.split.optionSetSplitChar'), `${translate('commands.split.optionSetSplitCharDescription')}${currentSplitChar ? ` ${curSplitCharStr}` : ''} ${defSplitCharStr(translate)}`)
      .addOption(translate('commands.split.optionSetPrependChar'), `${translate('commands.split.optionSetPrependCharDescription')}${currentSplitPrepend ? ` ${curPrependCharStr}` : ''} ${defPrependCharStr(translate)}`)
      .addOption(translate('commands.split.optionSetAppendChar'), `${translate('commands.split.optionSetAppendCharDescription')}${currentSplitAppend ? ` ${curAppendCharStr}` : ''} ${defAppendCharStr(translate)}`)
      .addOption(translate('commands.split.optionSetMaxLength'), `${translate('commands.split.optionSetMaxLengthDescription')}${currentSplitLength ? ` ${curMaxLenStr}` : ''} ${defMaxLenStr(translate)}`)
      .addOption(translate('commands.split.optionDisable'), '\u200b')
  }

  return { ...data,
    next: {
      menu: nextMenu
    }
  }
}

async function enable (m, data) {
  // This function only triggers if it is initially disabled
  const { feed, translate } = data
  if (m.content !== '1') {
    throw new MenuUtils.MenuOptionError()
  }

  feed.split = {
    enabled: true
  }

  await feed.save()
  log.command.info(`Enabled message splitting for ${feed.url}`, m.channel.guild)

  const nextMenu = new MenuUtils.Menu(m, selectSetting)
    .setAuthor(translate('commands.split.messageSplittingOptions'))
    .setDescription(translate('commands.split.enabledDescription', { title: feed.title, link: feed.url }))
    .addOption(translate('commands.split.optionSetSplitChar'), `${translate('commands.split.optionSetSplitCharDescription')} ${defSplitCharStr(translate)}`)
    .addOption(translate('commands.split.optionSetPrependChar'), `${translate('commands.split.optionSetPrependCharDescription')} ${defPrependCharStr(translate)}`)
    .addOption(translate('commands.split.optionSetAppendChar'), `${translate('commands.split.optionSetAppendCharDescription')} ${defAppendCharStr(translate)}`)
    .addOption(translate('commands.split.optionSetMaxLength'), `${translate('commands.split.optionSetMaxLengthDescription')} ${defMaxLenStr(translate)}`)
    .addOption(translate('commands.split.optionDisable'), '\u200b')

  return { ...data,
    next: {
      menu: nextMenu
    } }
}

async function selectSetting (m, data) {
  const { feed, translate } = data
  const selected = m.content

  if (selected === '5') {
    feed.split = undefined
    await feed.save()
    log.command.info(`Disabled message splitting for ${feed.url}`, m.channel.guild)
    await m.channel.send(translate('commands.split.disabledSuccess', { link: feed.url }))
    return data
  }

  let nextText = ''
  if (selected === '1') {
    nextText = translate('commands.split.promptSplitChar')
  } else if (selected === '2') {
    nextText = translate('commands.split.promptPrependChar')
  } else if (selected === '3') {
    nextText = translate('commands.split.promptAppendChar')
  } else if (selected === '4') {
    nextText = translate('commands.split.promptMaxLen')
  } else {
    throw new MenuUtils.MenuOptionError()
  }

  return { ...data,
    selected: selected,
    next: {
      text: nextText,
      menu: new MenuUtils.Menu(m, setSetting)
    } }
}

async function setSetting (m, data) {
  const { feed, profile, selected, translate } = data
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  let successText = ''

  const translateArg = { link: feed.url }
  if (selected === '1') {
    if (m.content === 'reset') {
      delete feed.split.char
      successText = translate('commands.split.resetSplitChar', translateArg)
      log.command.info(`Message splitting split character for ${feed.url} resetting`, m.channel.guild)
    } else if (m.content === '\\n' && feed.split.char === undefined) throw new MenuUtils.MenuOptionError(translate('commands.split.setSplitCharDefault'))
    else {
      feed.split.char = m.content
      successText = translate('commands.split.setSplitChar', { link: feed.url, content: m.content })
      log.command.info(`Message splitting split character for ${feed.url} setting to ${m.content}`, m.channel.guild)
    }
  } else if (selected === '2') {
    if (m.content === 'reset') {
      delete feed.split.prepend
      successText = translate('commands.split.resetPrependChar', translateArg)
      log.command.info(`Message splitting prepend character for ${feed.url} has been reset`, m.channel.guild)
    } else {
      feed.split.prepend = m.content
      successText = translate('commands.split.setPrependChar', { link: feed.url, content: escapeBackticks(m.content) })
      log.command.info(`Message splitting prepend character for ${feed.url} setting to ${m.content}`, m.channel.guild)
    }
  } else if (selected === '3') {
    if (m.content === 'reset') {
      delete feed.split.append
      successText = translate('commands.split.resetAppendChar', translateArg)
      log.command.info(`Message splitting append character for ${feed.url} resetting`, m.channel.guild)
    } else {
      feed.split.append = m.content
      successText = translate('commands.split.setAppendChar', { link: feed.url, content: escapeBackticks(m.content) })
      log.command.info(`Message splitting append character for ${feed.url} setting to ${m.content}`, m.channel.guild)
    }
  } else if (selected === '4') {
    const num = parseInt(m.content, 10)
    if (m.content === 'reset') {
      delete feed.split.maxLength
      successText = translate('commands.split.resetMaxLen', translateArg)
      log.command.info(`Message splitting max length for ${feed.url} resetting`, m.channel.guild)
    } else if (!/^\d+$/.test(m.content) || num < 500 || num > 1950) {
      throw new MenuUtils.MenuOptionError(translate('commands.split.setInvalidMaxLen'))
    } else {
      feed.split.maxLength = num
      successText = translate('commands.split.setMaxLen', { link: feed.url, num })
      log.command.info(`Message splitting max length for ${feed.url} setting to ${m.content}`, m.channel.guild)
    }
  }

  await feed.save()
  await m.channel.send(`${successText} ${translate('generics.backupReminder', { prefix })}`)
  return data
}

module.exports = async (bot, message, command) => {
  try {
    const profile = await Profile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command }, feeds)
    await new MenuUtils.MenuSeries(message, [feedSelector], { profile, locale: guildLocale, translate: Translator.createLocaleTranslator(guildLocale) }).start()
  } catch (err) {
    log.command.warning(`rsssplit`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsssplit 1', message.guild, err))
  }
}

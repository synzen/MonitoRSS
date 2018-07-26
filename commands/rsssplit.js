const config = require('../config.json')
const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
function escapeBackticks (str) {
  return str.replace('`', '​`') // Replace backticks with zero-width space and backtick to escape
}

function feedSelectorFn (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const splitOptions = source.splitMessage // Show toggle if it is disabled

  const nextMenu = new MenuUtils.Menu(m, splitOptions ? selectSetting : enable)
    .setAuthor('Message Splitting Options')
    .setDescription(`**Feed Title:** ${source.title}\n**Feed Link:** ${source.link}\n\nMessage splitting for this feed is currently ${splitOptions ? 'enabled' : 'disabled'}. Select an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n`)

  const currentSplitChar = splitOptions ? splitOptions.char : undefined
  const currentSplitPrepend = splitOptions ? splitOptions.prepend : undefined
  const currentSplitAppend = splitOptions ? splitOptions.append : undefined
  const currentSplitLength = splitOptions ? splitOptions.maxLength : undefined

  if (!splitOptions) nextMenu.addOption('Enable Message Splitting', 'Message splitting splits a message that exceeds the Discord character limit into multiple messages instead.')
  else {
    nextMenu
      .addOption(`Set split character`, `Specify the character that the message should split according to.${currentSplitChar ? ` Currently set to \`${escapeBackticks(currentSplitChar)}\`.` : ''} Default is \`\\n\` (new lines).`)
      .addOption('Set prepend character', `Specify the character that every message except the first should be prepended (added before) with.${currentSplitPrepend ? ` Currently set to \`${escapeBackticks(currentSplitPrepend)}\`.` : ''} Default is nothing. `)
      .addOption('Set append character', `Specify the character that every message except the last should be appended (added after) with.${currentSplitAppend ? ` Currently set to \`${escapeBackticks(currentSplitAppend)}\`.` : ''} Default is nothing.`)
      .addOption('Set max length', `Specify the maximum length a single message should have.${currentSplitLength ? ` Currently set to \`${currentSplitLength}\`.` : ''} Default is \`1950\`.`)
      .addOption('Disable Message Splitting', 'Default is disabled.')
  }

  callback(null, { ...data,
    next: {
      menu: nextMenu
    }
  })
}

function enable (m, data, callback) {
  // This function only triggers if it is initially disabled
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]

  if (m.content !== '1') return callback(new SyntaxError())

  source.splitMessage = { enabled: true }
  dbOps.guildRss.update(guildRss)

  log.command.info(`Message splitting has been enabled for ${source.link}`, m.channel.guild)
  const nextMenu = new MenuUtils.Menu(m, selectSetting)
    .setAuthor('Message Splitting Options')
    .setDescription(`**Feed Title:** ${source.title}\n**Feed Link:** ${source.link}\n\n**Message Splitting is now enabled for this feed.**\n\nYou may customize message splitting further by selecting one of the options below by typing its number, or type **exit** to leave as is. It is recommended to leave at the default settings.\u200b\n\u200b\n`)
    .addOption(`Set split character`, `Specify the character that the message should split on. Default is \`\\n\` (new lines).`)
    .addOption('Set prepend character', 'Specify the character that every message except the first should be prepended (added before) with. Default is nothing. ')
    .addOption('Set append character', 'Specify the character that every message except the last should be appended (added after) with. Default is nothing.')
    .addOption('Set max length', 'Specify the maximum length a single message should have. Default is `1950`.')
    .addOption('Disable Message Splitting', 'Default is disabled.')

  callback(null, { ...data,
    next: {
      menu: nextMenu
    }})
}

function selectSetting (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const selected = m.content

  if (selected === '5') {
    delete source.splitMessage
    dbOps.guildRss.update(guildRss)
    m.channel.send(`Message splitting is now disabled for feed <${source.link}>.`).catch(err => log.command.warning('rsssplit 1', m.channel.guild, err))
    log.command.info(`Message splitting has been disabled for ${source.link}`, m.channel.guild)
    return callback(null, data)
  }

  let nextText = ''
  if (selected === '1') nextText = 'Type a split character now, `reset` to reset, or `exit` to cancel.'
  else if (selected === '2') nextText = 'Type a prepend character now, `reset` to reset, or `exit` to cancel.'
  else if (selected === '3') nextText = 'Type an append character now, `reset` to reset, or `exit` to cancel.'
  else if (selected === '4') nextText = 'Type the max length a single message should have now, `reset` to reset, or `exit` to cancel. **Must be a number >= 500 and <= 1950.**'
  else return callback(new SyntaxError())

  callback(null, { ...data,
    selected: selected,
    next: {
      text: nextText,
      menu: new MenuUtils.Menu(m, setSetting)
    }})
}

function setSetting (m, data, callback) {
  const { guildRss, rssName, selected } = data
  const source = guildRss.sources[rssName]

  let successText = ''

  if (selected === '1') {
    if (m.content === 'reset') {
      delete source.splitMessage.char
      successText = `The split character for the feed <${source.link}> has been reset to \`\\n\`.`
      log.command.info(`Message splitting split character for ${source.link} has been reset`, m.channel.guild)
    } else if (m.content === '\\n' && source.splitMessage.char === undefined) return callback(new SyntaxError('That is already the default character. Try again, or type `exit` to cancel and leave it at default.'))
    else {
      source.splitMessage.char = m.content
      successText = `The split character for the feed <${source.link}> has been set to \`${m.content}\`.`
      log.command.info(`Message splitting split character for ${source.link} has been set to ${m.content}`, m.channel.guild)
    }
  } else if (selected === '2') {
    if (m.content === 'reset') {
      delete source.splitMessage.prepend
      successText = `The prepend character for the feed <${source.link}> has been reset to be nothing.`
      log.command.info(`Message splitting prepend character for ${source.link} has been reset`, m.channel.guild)
    } else {
      source.splitMessage.prepend = m.content
      successText = `The prepend character for the feed <${source.link}> has been set to \`${escapeBackticks(m.content)}\`.`
      log.command.info(`Message splitting prepend character for ${source.link} has been set to ${m.content}`, m.channel.guild)
    }
  } else if (selected === '3') {
    if (m.content === 'reset') {
      delete source.splitMessage.append
      successText = `The append character for the feed <${source.link}> has been reset to be nothing.`
      log.command.info(`Message splitting append character for ${source.link} has been reset`, m.channel.guild)
    } else {
      source.splitMessage.append = m.content
      successText = `The append character for the feed <${source.link}> has been set to \`${escapeBackticks(m.content)}\`.`
      log.command.info(`Message splitting append character for ${source.link} has been set to ${m.content}`, m.channel.guild)
    }
  } else if (selected === '4') {
    const num = parseInt(m.content, 10)
    if (m.content === 'reset') {
      delete source.splitMessage.maxLength
      successText = `The max length for a single message for the feed <${source.link}> has been reset to be \`1950\`.`
      log.command.info(`Message splitting max length for ${source.link} has been reset`, m.channel.guild)
    } else if (!/^\d+$/.test(m.content) || num < 500 || num > 1950) return callback(new SyntaxError('That is not a valid number >= 500 and <= 1950. Try again.'))
    else {
      source.splitMessage.maxLength = num
      successText = `The max length for a single message for the feed <${source.link}> has been set to \`${num}\`.`
      log.command.info(`Message splitting max length for ${source.link} has been set to ${m.content}`, m.channel.guild)
    }
  }

  dbOps.guildRss.update(guildRss)
  m.channel.send(`${successText} After completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`).catch(err => log.command.warning(`rsssplit 2`, m.channel.guild, err))
  return callback(null, data)
}

module.exports = (bot, message, command) => {
  const feedSelector = new FeedSelector(message, feedSelectorFn, { command })

  new MenuUtils.MenuSeries(message, [feedSelector]).start(async err => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
    } catch (err) {
      log.command.warning(`rsssplit`, message.guild, err)
    }
  })
}

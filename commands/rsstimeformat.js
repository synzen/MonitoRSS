const config = require('../config.json')
const fileOps = require('../util/fileOps.js')
const currentGuilds = require('../util/storage.js').currentGuilds

// To avoid stack call exceeded
function checkObjType (item, results) {
  if (Object.prototype.toString.call(item) === '[object Object]') {
    return function () {
      return findDatePlaceholders(item, results)
    }
  } else if (typeof item === 'string' && item.search(/{date}/) !== -1) results.push(true)
}

// Used to find images in any object values of the article
function findDatePlaceholders (obj, results) {
  for (var key in obj) {
    let value = checkObjType(obj[key], results)
    while (typeof value === 'function') {
      value = value()
    }
  }
}

module.exports = function (bot, message) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('You cannot set a custom time format if you have not added any feeds.').catch(err => console.log(`Promise Warning: rsstimeformat 1: ${err}`))

  const oldFormat = (guildRss.timeFormat) ? guildRss.timeFormat : config.feedSettings.timeFormat
  const msgArray = message.content.split(' ')

  if (msgArray.length <= 1) return message.channel.send(`Setting a custom date format is only useful if you intend on using customized messages with the \`{date}\` placeholder. To set a custom date format, the syntax is \`${config.botSettings.prefix}rsstimeformat date_format_here\`. To reset back to the default (\`${config.feedSettings.timeFormat}\`), type \`${config.botSettings.prefix}rsstimeformat reset\`.\n\nSee <https://momentjs.com/docs/#/displaying/> on how to format a date.`).catch(err => console.log(`Promise Warning: rsstimeformat 3a: ${err}`))

  let results = []
  findDatePlaceholders(guildRss.sources, results)
  if (results.length === 0) return message.channel.send('You cannot set your a custom time format if you don\'t use the `{date}` placeholder in any of your feeds.').catch(err => console.log(`Promise Warning: rsstimeformat 3b: ${err}`))

  msgArray.shift()

  const dateFormat = msgArray.join(' ').trim()

  if (dateFormat === 'reset' && !guildRss.timeFormat) return message.channel.send(`Your time format is already at default.`).catch(err => console.log(`Promise Warning: rsstimeformat 5: ${err}`))
  else if (dateFormat === guildRss.timeFormat) return message.channel.send(`Your time format is already set as \`${guildRss.timeFormat}\`.`).catch(err => console.log(`Promise Warning: rsstimeformat 6: ${err}`))

  if (dateFormat === 'reset' || dateFormat === config.feedSettings.timeFormat) {
    delete guildRss.timeFormat
    message.channel.send(`Time format has been reset to the default: \`${config.feedSettings.timeFormat}\`.`).catch(err => console.log(`Promise Warning: rsstimeformat 8: ${err}`))
    console.log(`RSS Time Format: (${message.guild.id}, ${message.guild.name}) => Time format reset from '${oldFormat}' to '${config.feedSettings.timeFormat}.'`)
  } else {
    guildRss.timeFormat = dateFormat
    message.channel.send(`Time format has been successfully updated to \`${dateFormat}\``).catch(err => console.log(`Promise Warning: rsstimeformat 9: ${err}`))
    console.log(`RSS Time Format: (${message.guild.id}, ${message.guild.name}) => Date format updated from '${oldFormat}' to '${dateFormat}.'`)
  }

  return fileOps.updateFile(message.guild.id, guildRss)
}

const config = require('../config.json')
const moment = require('moment-timezone')
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
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('You cannot set your timezone if you have not added any feeds.').catch(err => console.log(`Promise Warning: rssTimezone 1: ${err}`))

  const oldTimezone = (guildRss.timezone) ? guildRss.timezone : config.feedSettings.timezone
  const msgArray = message.content.split(' ')

  if (msgArray.length <= 1) return message.channel.send(`Setting your timezone is only useful if you intend on using customized messages with the \`{date}\` placeholder. To set your timezone, the syntax is \`${config.botSettings.prefix}rsstimezone your_timezone_here\`. To reset back to the default (${config.feedSettings.timezone}), type \`${config.botSettings.prefix}rsstimezone reset\`.\n\nSee <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for a list of timezones under the TZ column.`).catch(err => console.log(`Promise Warning: rssTimezone 3a: ${err}`))

  let results = []
  findDatePlaceholders(guildRss.sources, results)
  if (results.length === 0) return message.channel.send('You cannot set your timezone if you don\'t use the `{date}` placeholder in any of your feeds.').catch(err => console.log(`Promise Warning: rssTimezone 3b: ${err}`))

  const timezone = msgArray[msgArray.length - 1]

  if (timezone !== 'reset' && !moment.tz.zone(timezone)) return message.channel.send(`\`${timezone}\` is not a valid timezone. See <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for more information. Valid timezones are in the \`TZ\` column.`).catch(err => console.log(`Promise Warning: rssTimezone 4: ${err}`))
  else if (timezone === 'reset' && !guildRss.timezone) return message.channel.send(`Your timezone is already at default.`).catch(err => console.log(`Promise Warning: rssTimezone 5: ${err}`))
  else if (timezone === guildRss.timezone) return message.channel.send(`Your timezone is already set as \`${guildRss.timezone}\`.`).catch(err => console.log(`Promise Warning: rssTimezone 6: ${err}`))

  if (timezone === 'reset' || timezone === config.feedSettings.timezone) {
    delete guildRss.timezone
    message.channel.send(`Timezone has been reset to the default: \`${config.feedSettings.timezone}\`.`).catch(err => console.log(`Promise Warning: rssTimezone 8: ${err}`))
    console.log(`RSS Timezone: (${message.guild.id}, ${message.guild.name}) => Timezone reset from '${oldTimezone}' to '${config.feedSettings.timezone}.'`)
  } else {
    guildRss.timezone = timezone
    message.channel.send(`Timezone has been successfully updated to \`${timezone}\``).catch(err => console.log(`Promise Warning: rssTimezone 9: ${err}`))
    console.log(`RSS Timezone: (${message.guild.id}, ${message.guild.name}) => Timezone updated from '${oldTimezone}' to '${timezone}.'`)
  }

  return fileOps.updateFile(message.guild.id, guildRss)
}

const config = require('../config.json')
const moment = require('moment-timezone')
const fileOps = require('../util/fileOps.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const allowedFieldKeys = ['message', 'embedMessage'] // Where {date} must be found for rsstimezone to work

function hasTimezone(object) {
  for (var key in object) {
    if (typeof object[key] === 'string' && allowedFieldKeys.includes(key) && object[key].search(/{date}/) !== -1) return true;
    else if (typeof object[key] === 'object' && hasTimezone(object[key])) return true;
  }
  return false
}

module.exports = function(bot, message) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('You cannot set your timezone if you have not added any feeds.').catch(err => console.log(`Promise Warning: rssTimezone 1: ${err}`));

  const oldTimezone = (guildRss.timezone) ? guildRss.timezone : config.feedSettings.timezone
  const msgArray = message.content.split(' ')

  if (msgArray.length <= 1) return message.channel.send(`Setting your timezone is only useful if you intend on using customized messages with the \`{date}\` tag. To set your timezone, the syntax is \`${config.botSettings.prefix}rsstimezone your_timezone_here\`. To reset back to the default (${config.feedSettings.timezone}), type \`${config.botSettings.prefix}rsstimezone reset\`.\n\nSee <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for a list of timezones under the TZ column.`).catch(err => console.log(`Promise Warning: rssTimezone 3a: ${err}`));

  if (!hasTimezone(guildRss.sources)) return message.channel.send('You cannot set your timezone if you don\'t use the `{date}` tag in any of your feeds.').catch(err => console.log(`Promise Warning: rssTimezone 3b: ${err}`));

  const timezone = msgArray[msgArray.length - 1]

  if (timezone !== 'reset' && !moment.tz.zone(timezone)) return message.channel.send(`\`${timezone}\` is not a valid timezone. See <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for more information. Valid timezones are in the \`TZ\` column.`).catch(err => console.log(`Promise Warning: rssTimezone 4: ${err}`));
  else if (timezone === 'reset' && !guildRss.timezone) return message.channel.send(`Your timezone is already at default.`).catch(err => console.log(`Promise Warning: rssTimezone 5: ${err}`));
  else if (timezone == guildRss.timezone) return message.channel.send(`Your timezone is already set as \`${guildRss.timezone}\`.`).catch(err => console.log(`Promise Warning: rssTimezone 6: ${err}`));
  else if (timezone == config.feedSettings.timezone) return message.channel.send(`${timezone} is already the default timezone.`).catch(err => console.log(`Promise Warning: rssTimezone 7: ${err}`));

  if (timezone === 'reset') {
    delete guildRss.timezone;
    message.channel.send(`Timezone has been reset to the default: \`${config.feedSettings.timezone}\`.`).catch(err => console.log(`Promise Warning: rssTimezone 8: ${err}`));
    console.log(`RSS Guild Info: (${message.guild.id}, ${message.guild.name}) => Timezone reset from '${oldTimezone}' to '${config.feedSettings.timezone}.'`);
  }
  else {
    guildRss.timezone = timezone;
    message.channel.send(`Timezone has been successfully updated to \`${timezone}\``).catch(err => console.log(`Promise Warning: rssTimezone 9: ${err}`));
    console.log(`RSS Guild Info: (${message.guild.id}, ${message.guild.name}) => Timezone updated from '${oldTimezone}' to '${timezone}.'`);
  }

  return fileOps.updateFile(message.guild.id, guildRss)

}

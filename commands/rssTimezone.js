const config = require('../config.json')
const moment = require('moment-timezone')
const fileOps = require('../util/updateJSON.js')

module.exports = function (message) {
  // if (!fileOps.exists(`./sources/${message.guild.id}.json`)) return message.channel.sendMessage("You cannot set your timezone if you have not added any feeds.");

  try {
    var guild = require(`../sources/${message.guild.id}.json`)
    if (guild.sources.length == 0) return message.channel.sendMessage("You cannot set your timezone if you have not added any feeds.").catch(err => console.log(`Promise Warning: rssTimezone 1: ${err}`));
  }
  catch (e) {
    return message.channel.sendMessage("You cannot set your timezone if you have not added any feeds.").catch(err => console.log(`Promise Warning: rssTimezone 2: ${err}`));
  }

  if (guild.timezone == null) var oldTimezone = config.feedSettings.timezone;
  else var oldTimezone = guild.timezone;

  var msgArray = message.content.split(" ")
  if (msgArray.length <= 1) return message.channel.sendMessage(`Setting your timezone is only useful if you intend on using customized messages with the \`{date}\` tag. To set your timezone, the syntax is \`${config.prefix}rsstimezone your_timezone_here\`. To reset back to the default (${config.feedSettings.timezone}), type \`${config.prefix}rsstimezone reset\`.\n\nSee <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for a list of timezones under the TZ column.`).catch(err => console.log(`Promise Warning: rssTimezone 3: ${err}`));
  let timezone = msgArray[msgArray.length - 1]

  if (timezone !== "reset" && moment.tz.zone(timezone) == null) return message.channel.sendMessage(`\`${timezone}\` is not a valid timezone. See <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for more information. Valid timezones are in the \`TZ\` column.`).catch(err => console.log(`Promise Warning: rssTimezone 4: ${err}`));
  else if (timezone == "reset" && guild.timezone == null) return message.channel.sendMessage(`Your timezone is already at default.`).catch(err => console.log(`Promise Warning: rssTimezone 5: ${err}`));
  else if (timezone == guild.timezone) return message.channel.sendMessage(`Your timezone is already set as \`${guild.timezone}\`.`).catch(err => console.log(`Promise Warning: rssTimezone 6: ${err}`));
  else if (timezone == config.feedSettings.timezone) return message.channel.sendMessage(`${timezone} is already the default timezone.`).catch(err => console.log(`Promise Warning: rssTimezone 7: ${err}`));

  if (timezone == "reset") {
    delete guild.timezone;
    message.channel.sendMessage(`Timezone has been reset to the default: \`${config.feedSettings.timezone}\`.`).catch(err => console.log(`Promise Warning: rssTimezone 8: ${err}`));
    console.log(`RSS Guild Info: (${message.guild.id}, ${message.guild.name}) => Timezone reset from '${oldTimezone}' to '${config.feedSettings.timezone}.'`);
  }
  else {
    guild.timezone = timezone;
    message.channel.sendMessage(`Timezone has been successfully updated to \`${timezone}\``).catch(err => console.log(`Promise Warning: rssTimezone 9: ${err}`));
    console.log(`RSS Guild Info: (${message.guild.id}, ${message.guild.name}) => Timezone updated from '${oldTimezone}' to '${timezone}.'`);
  }

  return fileOps.updateFile(message.guild.id, guild, `../sources/${message.guild.id}.json`)

}

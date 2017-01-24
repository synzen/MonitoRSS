const rssConfig = require('../../config.json')
const moment = require('moment-timezone')
const fileOps = require('../util/updateJSON.js')

module.exports = function (message) {
  var guild = require(`../sources/${message.guild.id}.json`)

  if (guild.timezone == null) var oldTimezone = rssConfig.timezone;
  else var oldTimezone = guild.timezone;

  var msgArray = message.content.split(" ")
  if (msgArray.length <= 1) return message.channel.sendMessage(`To set your timezone, the syntax is \`${rssConfig.prefix}rsstimezone your_timezone_here\`.\nSee <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for a list of timezones under the TZ column.`);
  let timezone = msgArray[msgArray.length - 1]

  if (moment.tz.zone(timezone) == null) return message.channel.sendMessage(`\`${timezone}\` is not a valid timezone. See <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for more information. Valid timezones are in the \`TZ\` column.`);
  if (timezone == guild.timezone) return message.channel.sendMessage(`Your timezone is already set as \`${guild.timezone}\`.`)

  guild.timezone = msgArray[1]
  fileOps.updateFile(`./sources/${message.guild.id}.json`, guild, `../sources/${message.guild.id}.json`)
  message.channel.sendMessage(`Timezone has been successfully updated to \`${timezone}\``)
  console.log(`RSS Guild Info: (${message.guild.id}, ${message.guild.name}) => Timezone updated from '${oldTimezone}' to '${timezone}.'`)
}

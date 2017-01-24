var rssConfig = require('../config.json')
const rssAdd = require('../commands/addRSS.js')
const rssHelp = require('../commands/helpRSS.js')
const rssPrintList = require('../commands/util/printFeeds.js')
const checkPerm = require('../util/checkPerm.js')
const rssTimezone = require('../commands/timezone.js')

const commands = {
  rssadd: {description: "Add an RSS feed to the channel with the default message."},
  rssremove: {description: "Open a menu to delete a feed from the channel.", file: "removeRSS"},
  rssmessage: {description: "Open a menu to customize a feed's text message.", file: "customMessage"},
  rssembed: {description: "Open a menu to customzie a feed's embed message. This will replace the normal embed Discord usually sends when a link is posted.", file: "customEmbed"},
  rsstest: {description: "Opens a menu to send a test message for a specific feed, along with the available properties and tags for customization.", file: "testRSS"},
  rsstimezone: {description: `Change the timezone for dates given by {date} tag customization. Default is \`${rssConfig.timezone}\`. For a list of timezones, see the TZ column at <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones>.`},
  rssfilteradd: {description: "Opens a menu to add filters.", file: "filterAdd"},
  rssfilterremove: {description: "Opens a menu to remove filters.", file: "filterRemove"}
}

module.exports = function (bot, message) {
  if (message.member == null || !message.member.hasPermission("MANAGE_CHANNELS") || message.author.bot) return;
  var m = message.content.split(" ")
  let command = m[0].substr(rssConfig.prefix.length)

  var hasPermission = checkPerm(bot, message.channel)

  if (command == "rssadd" && hasPermission){
    rssAdd(bot, message);
  }

  else if (command == "rsshelp" && hasPermission) {
    rssHelp(message, commands);
  }
  else if (command == "rsslist" && hasPermission) {
    rssPrintList(bot, message, false, "");
  }
  else if (command == "rsstimezone" && hasPermission) {
    rssTimezone(message);
  }

  //for commands that needs menu selection, AKA collectors
  else for (let cmd in commands) {
    if (command == cmd && hasPermission) {
      inProgress = true;
      rssPrintList(bot, message, true, commands[cmd].file)
    }
  }

}

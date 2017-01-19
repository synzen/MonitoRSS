var rssConfig = require('../config.json')
const rssAdd = require('../commands/addRSS.js')
const rssHelp = require('../commands/helpRSS.js')
const rssPrintList = require('../commands/util/printFeeds.js')

const commands = {
  rssadd: {description: "Add an RSS feed to the channel with the default message."},
  rssremove: {description: "Open a menu to delete a feed from the channel.", file: "removeRSS"},
  rssmessage: {description: "Open a menu to customize a feed's text message.", file: "customMessage"},
  rssembed: {description: "Open a menu to customzie a feed's embed message. This will replace the normal embed Discord usually sends when a link is posted.", file: "customEmbed"},
  rsstest: {description: "Opens a menu to send a test message for a specific feed, along with the available properties and tags for customization.", file: "testRSS"},
  rssfilteradd: {description: "Opens a menu to add filters.", file: "filterAdd"},
  rssfilterremove: {description: "Opens a menu to remove filters.", file: "filterRemove"}
}


module.exports = function (bot, message) {

  if (message.member == null || !message.member.hasPermission("MANAGE_CHANNELS") || message.author.bot ) return;
  var m = message.content.split(" ")
  let command = m[0].substr(rssConfig.prefix.length)

  function hasPermission() {
    let guild = bot.guilds.get(message.guild.id)
    let guildBot = guild.members.get(bot.user.id)
    if (!guildBot.permissionsIn(message.channel).hasPermission("SEND_MESSAGES")) {
      console.log(`RSS Permissions Error: (${message.guild.id}, ${message.guild.name}) => Cannot open menus due to missing send message permission in channel (${message.channel.id}, ${message.channel.name})`);
      return false;
    }
    else return true;
  }

  if (command == "rssadd" && hasPermission()){
    rssAdd(bot, message);
  }

  else if (command == "rsshelp" && hasPermission()) {
    rssHelp(message, commands);
  }
  else if (command == "rsslist" && hasPermission()) {
    rssPrintList(message, false, "")
  }

  //for commands that needs menu selection, AKA collectors
  else for (let cmd in commands) {
    if (command == cmd && hasPermission()) {
      inProgress = true;
      rssPrintList(message, true, commands[cmd].file)
    }
  }

}

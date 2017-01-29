

module.exports = function (content, bot, channel) {

  let guild = bot.guilds.get(channel.guild.id)
  let guildBot = guild.members.get(bot.user.id)
  if (!guildBot.permissionsIn(channel).hasPermission("SEND_MESSAGES")) {
    channel.sendMessage("A guild permission error has been found. Try recreating the bot's role if it exists, or specifically adding the bot's name to permissions.").then(m => console.log("error: message actually sent.")).catch(err => console.log("Successful block"));
    console.log(`Guild Permissions Error: (${guild.id}, ${guild.name}) => Cannot execute '${content}' due to missing send message permission in channel (${channel.id}, ${channel.name})`);
    return false;
  }
  else return true;

}

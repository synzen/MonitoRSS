

module.exports = function (content, bot, channel) {

  let guild = bot.guilds.get(channel.guild.id)
  let guildBot = guild.members.get(bot.user.id)
  if (!guildBot.permissionsIn(channel).hasPermission("SEND_MESSAGES")) {
    console.log(`Guild Permissions Error: (${guild.id}, ${guild.name}) => Cannot execute '${content}' due to missing send message permission in channel (${channel.id}, ${channel.name})`);
    return false;
  }
  else return true;

}

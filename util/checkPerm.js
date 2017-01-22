

module.exports = function (bot, channel) {

  let guild = bot.guilds.get(channel.guild.id)
  let guildBot = guild.members.get(bot.user.id)
  if (!guildBot.permissionsIn(channel).hasPermission("SEND_MESSAGES")) {
    console.log(`RSS Permissions Error: (${guild.id}, ${guild.name}) => Cannot open menus due to missing send message permission in channel (${channel.id}, ${channel.name})`);
    return false;
  }
  else return true;

}

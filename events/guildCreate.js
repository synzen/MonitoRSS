
module.exports = function (bot, guild) {

  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been added.`)
  bot.channels.get('267436614110806024').sendMessage(`Guild Info: "${guild.name}" has been added.\nUsers: ${guild.members.size}\nOwner: ${guild.owner.user.username} (${guild.owner})`)

}

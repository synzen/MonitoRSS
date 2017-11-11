
exports.normal = function (bot, message) {
  message.channel.send(`Guilds: ${bot.guilds.size}\nUsers: ${bot.users.size}\nChannels: ${bot.channels.size}`).catch(err => console.log('Bot Controller: Could not send stats, reason:\n', err))
}

exports.sharded = function (bot, message) {
  bot.shard.broadcastEval('[this.guilds.size,this.users.size,this.channels.size]').then(results => {
    let guilds = 0
    let users = 0
    let channels = 0
    for (var x in results) {
      guilds += results[x][0]
      users += results[x][1]
      channels += results[x][2]
    }
    message.channel.send(`Guilds: ${guilds}\nUsers: ${users}\nChannels: ${channels}`).catch(err => console.log('Bot Controller: Could not send stats. ', err.message || err))
  }).catch(err => console.log('Bot Controller: Unable to broadcast eval stats. ', err.message || err))
}

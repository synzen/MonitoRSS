const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  message.channel.send(`Guilds: ${bot.guilds.size}\nUsers: ${bot.users.size}\nChannels: ${bot.channels.size}`).catch(err => log.controller.warning('Could not send stats', message.author, err))
}

exports.sharded = (bot, message) => {
  bot.shard.broadcastEval('[this.guilds.size,this.users.size,this.channels.size]').then(results => {
    let guilds = 0
    let users = 0
    let channels = 0
    for (var x in results) {
      guilds += results[x][0]
      users += results[x][1]
      channels += results[x][2]
    }
    message.channel.send(`Guilds: ${guilds}\nUsers: ${users}\nChannels: ${channels}`).catch(err => log.controller.warning('Could not send stats', message.author, err))
  }).catch(err => log.controller.warning('Unable to broadcast eval stats', message.author, err))
}

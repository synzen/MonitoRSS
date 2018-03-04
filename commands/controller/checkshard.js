exports.normal = (bot, message) => message.channel.send('Not a sharded client.')

exports.sharded = (bot, message) => message.channel.send(bot.shard.id)

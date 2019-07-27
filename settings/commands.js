const redisIndex = require('../structs/db/Redis/index.js')
const redis = require('redis')

module.exports = function (bot, message) {
  if (message.content === '~mycustomcommand') message.channel.send('I saw your custom command!')
  else if (message.content === 'a') {
    redis.debug_mode = true
    redisIndex.GuildMember.utils.isMemberOfGuild('156576312985780224', '156576312985780224')
      .then(res => console.log('result', res)).catch(console.log)
  }
}

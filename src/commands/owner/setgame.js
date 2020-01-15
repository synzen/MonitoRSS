const log = require('../../util/logger.js')

function getGame (message) {
  const content = message.content.split(' ')
  if (content.length === 1) return undefined
  content.shift()
  let game = content.join(' ')
  if (game === 'null') game = null
  return game
}

module.exports = async (bot, message) => {
  const game = getGame(message)
  try {
    if (game === undefined) return await message.channel.send(`Text must be specified as the first argument, or \`null\` to remove an existing game.`)
    bot.shard.broadcastEval(`
      const path = require('path');
      const appDir = path.dirname(require.main.filename);
      const config = require(appDir + '/src/config.js');
      this.user.setPresence({ game: { name: ${game === null ? null : `${game}`}, type: 0 } });
      config.bot.game = game;
    `)
    await message.channel.send(`Successfully changed game to ${game}`)
  } catch (err) {
    log.owner.warning('setgame', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('setgame 1b', message.guild, err))
  }
}

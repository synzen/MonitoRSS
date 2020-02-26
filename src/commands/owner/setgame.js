const createLogger = require('../../util/logger/create.js')

function getGame (message) {
  const content = message.content.split(' ')
  if (content.length === 1) return undefined
  content.shift()
  let game = content.join(' ')
  if (game === 'null') game = null
  return game
}

module.exports = async (message) => {
  const game = getGame(message)
  if (game === undefined) {
    return message.channel.send(`Text must be specified as the first argument, or \`null\` to remove an existing game.`)
  }
  message.client.shard.broadcastEval(`
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const config = require(appDir + '/src/config.js');
    this.user.setPresence({ game: { name: ${game === null ? null : `${game}`}, type: 0 } });
    config.bot.game = game;
  `)
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Changed game to ${game}`)
  await message.channel.send(`Successfully changed game to ${game}`)
}

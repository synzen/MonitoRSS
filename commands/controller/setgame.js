const config = require('../../config.json')

function getGame (message) {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  let game = content.join(' ')
  if (game === 'null') game = null
}

exports.normal = function (bot, message) {
  const game = getGame(message)
  // bot.user.setGame(game)
  bot.user.setPresence({ game: { name: game, type: 0 } })
  config.botSettings.defaultGame = game // Make sure the change is saved even after a login retry
}

exports.sharded = function (bot, message) {
  bot.shard.broadcastEval(`
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const config = require(appDir + '/config.json');

    const content = '${message.content}'.split(' ');
    if (content.length > 1) {
      content.shift();
      let game = content.join(' ');
      if (game === 'null') game = null;

      this.user.setPresence({ game: { name: game, type: 0 } });
      config.botSettings.defaultGame = game;
    }
  `).catch(err => console.log(`Bot Controller: Unable to send setgame eval. `, err.message || err))
}

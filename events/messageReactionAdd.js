const pageControls = require('../util/pageControls.js')

module.exports = function(bot, msgReaction, user) {
  msgReaction.remove(user);
  if (msgReaction.emoji.name === '▶') pageControls.nextPage(msgReaction.message);
  else pageControls.prevPage(msgReaction.message);
}

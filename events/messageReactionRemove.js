const pageControls = require('../util/pageControls.js')

module.exports = (bot, msgReaction, user) => {
  if (msgReaction.emoji.name === '▶') pageControls.nextPage(msgReaction.message)
  else if (msgReaction.emoji.name === '◀') pageControls.prevPage(msgReaction.message)
}

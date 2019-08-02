const pageControls = require('../util/pageControls.js')

module.exports = (msgReaction, user) => {
  if ((msgReaction.emoji.name !== '▶' && msgReaction.emoji.name !== '◀') || user.bot || !pageControls.has(msgReaction.message.id)) return
  if (msgReaction.emoji.name === '▶') pageControls.nextPage(msgReaction.message)
  else if (msgReaction.emoji.name === '◀') pageControls.prevPage(msgReaction.message)
}

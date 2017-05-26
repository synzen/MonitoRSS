const pageControls = require('../util/pageControls.js')

module.exports = function (bot, msgReaction, user) {
  if (msgReaction.emoji.name === '▶') {
    msgReaction.remove(user).catch(err => console.log(`Commands Warning: Unable to remove ">" reaction, reason: `, err))
    pageControls.nextPage(msgReaction.message)
  } else if (msgReaction.emoji.name === '◀') {
    msgReaction.remove(user).catch(err => console.log(`Commands Warning: Unable to remove "<" reaction, reason: `, err))
    pageControls.prevPage(msgReaction.message)
  }
}

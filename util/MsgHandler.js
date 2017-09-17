const config = require('../config.json')

// For deletion at the end of a series of menus

module.exports = function (bot, msg) {
  const guildBot = msg.guild.members.get(bot.user.id)
  const allowed = !guildBot.permissionsIn(msg.channel).has('MANAGE_MESSAGES') ? false : config.botSettings.deleteMenus === true

  this.messageList = []

  this.add = function (msg) {
    if (allowed) this.messageList.push(msg)
  }

  this.deleteAll = function (channel) {
    if (allowed && this.messageList.length === 1) {
      this.messageList[0].delete().then(m => {
        this.messageList = []
      }).catch(err => {
        console.log(`Warning: Unable to delete single message after menu series\n`, err)
        this.messageList = []
      })
    } else if (allowed && this.messageList.length > 1) {
      channel.bulkDelete(this.messageList).then(function () {
        this.messageList = []
      }).catch(err => {
        this.messageList = []
        console.log(`Warning: Unable to bulk delete messages after menu series\n`, err)
      })
    }
  }

  this.merge = function (msgHandler) {
    for (var i in msgHandler.messageList) this.messageList.push(msgHandler.messageList[i])
  }
}

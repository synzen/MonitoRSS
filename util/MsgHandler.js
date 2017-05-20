const config = require('../config.json')

// For deletion at the end of a series of menus

module.exports = function(bot, msg) {
  const guildBot = msg.guild.members.get(bot.user.id)
  const allowed = !guildBot.permissionsIn(msg.channel).has("MANAGE_MESSAGES") ? false : config.botSettings.deleteMenus == true ? true : false

  this.messageList = [msg]

  this.add = function(msg) {
    if (allowed) this.messageList.push(msg);
  }

  this.remove = function(index) {
    if (allowed) this.messageList.splice(index, 1);
  }

  this.deleteAll = function(channel) {
    if (allowed && this.messageList.length > 0) {
      channel.bulkDelete(this.messageList).then(deleted => this.messageList = []).catch(err => console.log(`Warning: Unable to bulk delete messages, reason: ${err}, list is `));
    }
  }

  this.merge = function(msgHandler) {
    for (var i in msgHandler.messageList) this.messageList.push(msgHandler.messageList[i])
  }
}

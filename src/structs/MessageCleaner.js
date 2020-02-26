const config = require('../config.js')
const createLogger = require('../util/logger/create.js')

/**
 * Handles message tracking and bulk deletion
 */
class MessageCleaner {
  /**
     * Creates an instance of MessageCleaner.
     * @param {import('discord.js').Message} message A Discord.js Message
     * @memberof MessageCleaner
     */
  constructor (message) {
    const guildBot = message.guild.me
    this.channel = message.channel
    this._messageList = []
    this._allowed = false
    this.log = createLogger(message.guild.shard.id)
    if (!guildBot) {
      message.guild.members.cache.fetch(message.client.user).then(m => {
        this._allowed = m.permissionsIn(message.channel).has('MANAGE_MESSAGES') ? false : config.bot.deleteMenus === true
      }).catch(err => this.log.error(err, 'Unable to fetch client as member to determine message deletion permissions'))
    } else this._allowed = !guildBot.permissionsIn(message.channel).has('MANAGE_MESSAGES') ? false : config.bot.deleteMenus === true
  }

  /**
     * Add a Message to its messageList.
     *
     * @param {Message} message A Discord.js Message
     * @memberof MessageCleaner
     */
  add (message) {
    if (this._allowed) {
      this._messageList.push(message)
    }
  }

  /**
     * Delete all Messages in its messageList.
     *
     * @memberof MessageCleaner
     */
  deleteAll () {
    if (this._allowed && this._messageList.length === 1) {
      this._messageList[0].delete().then(m => {
        this._messageList = []
      }).catch(err => {
        this.log.error(err, `Unable to delete single message after menu series`)
        this._messageList = []
      })
    } else if (this._allowed && this._messageList.length > 1) {
      this.channel.bulkDelete(this._messageList).then(m => {
        this._messageList = []
      }).catch(err => {
        this._messageList = []
        this.log.error(err, `Unable to bulk delete messages after menu series`)
      })
    }
  }

  /**
     * Merge another MessageCleaner by copying its Messages to this one.
     *
     * @param {MessageCleaner} msgCleaner MessageCleaner to merge
     * @memberof MessageCleaner
     */
  merge (msgCleaner) {
    if (!msgCleaner) return
    msgCleaner._messageList.forEach(message => this._messageList.push(message))
  }
}

module.exports = MessageCleaner

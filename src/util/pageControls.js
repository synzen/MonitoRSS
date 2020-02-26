const createLogger = require('./logger/create.js')
const log = createLogger()

class PageContainer {
  constructor () {
    this.messageList = {}
  }

  /**
   * @param {import('discord.js').Message} message
   */
  async nextPage (message) {
    if (this.messageList[message.id].currentPage + 1 > this.messageList[message.id].pages.length - 1) return
    this.messageList[message.id].currentPage++
    const pageMsg = this.messageList[message.id]

    try {
      const m = await message.channel.messages.fetch(message.id)
      await m.edit({ embed: pageMsg.pages[pageMsg.currentPage] })
    } catch (err) {
      log.error(err, 'pageControls nextPage')
    }
  }

  /**
   * @param {import('discord.js').Message} message
   */
  async prevPage (message) {
    if (this.messageList[message.id].currentPage - 1 < 0) return
    this.messageList[message.id].currentPage--
    const pageMsg = this.messageList[message.id]

    try {
      const m = await message.channel.messages.fetch(message.id)
      await m.edit({ embed: pageMsg.pages[pageMsg.currentPage] })
    } catch (err) {
      log.error(err, 'pageControls prevpage')
    }
  }
}

const pageMsgs = new PageContainer()

exports.add = (msgId, pages) => {
  pageMsgs.messageList[msgId] = {
    currentPage: 0,
    pages: pages
  }
}
exports.nextPage = message => pageMsgs.nextPage(message)
exports.prevPage = message => pageMsgs.prevPage(message)
exports.has = id => pageMsgs.messageList[id]

// Used for pagination on feed lists that exceeds a certain amount

function PageContainer () {
  this.messageList = {}

  this.nextPage = function (msg) {
    if (this.messageList[msg.id].currentPage + 1 > this.messageList[msg.id].pages.length - 1) return
    this.messageList[msg.id].currentPage++

    let pageMsg = this.messageList[msg.id]

    msg.channel.fetchMessage(msg.id).then(m => m.edit({embed: pageMsg.pages[pageMsg.currentPage]})).catch(console.error)
  }

  this.prevPage = function (msg) {
    if (this.messageList[msg.id].currentPage - 1 < 0) return
    this.messageList[msg.id].currentPage--

    let pageMsg = this.messageList[msg.id]
    msg.channel.fetchMessage(msg.id).then(m => m.edit({embed: pageMsg.pages[pageMsg.currentPage]})).catch(console.error)
  }
}

let pageMsgs = new PageContainer()

exports.add = function (msgId, pages) {
  pageMsgs.messageList[msgId] = {
    currentPage: 0,
    pages: pages
  }
}

exports.nextPage = function (msg) {
  pageMsgs.nextPage(msg)
}

exports.prevPage = function (msg) {
  pageMsgs.prevPage(msg)
}

exports.has = function (id) {
  return pageMsgs.messageList[id]
}

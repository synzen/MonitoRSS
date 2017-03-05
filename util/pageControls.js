// reserved for when discord.js fixes their library

// function PageContainer() {
//
//   this.messageList = {}
//
//   this.nextPage = function(msg) {
//     if (this.messageList[msg.id].currentPage + 1 > this.messageList[msg.id].pages.length - 1) return;
//     this.messageList[msg.id].currentPage++

//     let pageMsg = this.messageList[msg.id]
//     msg.channel.fetchMessage(msg.id).then(m => m.edit(pageMsg.pages[pageMsg.currentPage])).catch(console.error)
//   }
//
//   this.prevPage = function(msg) {
//     if (this.messageList[msg.id].currentPage - 1 < 0) return;
//     this.messageList[msg.id].currentPage--
//
//     let pageMsg = this.messageList[msg.id]
//     msg.channel.fetchMessage(msg.id).then(m => m.edit(pageMsg.pages[pageMsg.currentPage])).catch(console.error)
//   }
// }
//
// var pageMsgs = new PageContainer()
//
// exports.add = function(id, pages) {
//   pageMsgs.messageList[id] = {
//     currentPage: 0,
//     pages: pages
//   }
//   console.info(pageMsgs.messageList)
// }
//
// exports.nextPage = function(msg) {
//   pageMsgs.nextPage(msg)
// }
//
// exports.prevPage = function(msg) {
//   pageMsgs.prevPage(msg)
// }
//
// exports.has = function(id) {
//   return pageMsgs.messageList[id]
// }

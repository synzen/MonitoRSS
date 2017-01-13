const rssPrintList = require('../commands/util/printFeeds.js')
const rssAdd = require('../commands/addRSS.js')
const rssHelp = require('../commands/helpRSS.js')


module.exports = function (message, command, justChecking) {
  const commands = {
    //rssadd: {description: "Add an RSS feed to the channel with the default message."},
    rssremove: {description: "Open a menu to delete a feed from the channel.", file: "removeRSS"},
    rssmessage: {description: "Open a menu to customize a feed's text message.", file: "customMessage"},
    rssembed: {description: "Open a menu to customzie a feed's embed message. This will replace the normal embed Discord usually sends when a link is posted.", file: "customEmbed"},
    rsstest: {description: "Opens a menu to send a test message for a specific feed, along with the available properties and tags for customization.", file: "testRSS"},
    rssfilteradd: {description: "Opens a menu to add filters.", file: "filterAdd"},
    rssfilterremove: {description: "Opens a menu to remove filters.", file: "filterRemove"}
  }
  const cmdList = {
    // rsshelp: {
    //   desc: "Opens this help menu.",
    //   execute: rssHelp(message)
    // },
    rsslist: {
      desc: "Add an RSS feed to the channel with the default message.",
      execute: rssAdd(message)
    },
    rssadd: {
      desc: "Add an RSS feed to the channel with the default message.",
      execute: rssAdd(message)
    },
    rssremove: {
      desc: "Open a menu to delete a feed from the channel.",
      execute: rssPrintList(message, true, 'removeRSS')
    },
    rssmessage: {
      desc: "Open a menu to customize a feed's text message.",
      execute: rssPrintList(message, true, 'customMessage')
    },
    rssembed: {
      desc: "Open a menu to customzie a feed's embed message. This will replace the normal embed Discord usually sends when a link is posted.",
      execute: rssPrintList(message, true, 'customEmbed')
    },
    rssfilteradd: {
      desc: "Opens a menu to add filters.",
      execute: rssPrintList(message, true, 'filterAdd')
    },
    rssfilterremove: {
      desc: "Opens a menu to remove filters.",
      execute: rssPrintList(message, true, 'filterRemove')
    },
    rsstest: {
      desc: "Opens a menu to send a test message for a specific feed, along with the available properties and tags for customization.",
      execute: rssPrintList(message, true, 'testRSS')
    }
  }


  // const cmdList = {commands: [{
  //   name: "rsshelp",
  //
  // },{
  //   name: "rsslist",
  //   desc: "Lists active feeds in current channel.",
  //   execute: rssPrintList(message, false)
  // },{
  //   name: "rssadd",
  //   desc: "Add an RSS feed to the channel with the default message.",
  //   execute: rssAdd(message)
  // },{
  //   name: "rssremove",
  //   desc: "Open a menu to delete a feed from the channel.",
  //   execute: rssPrintList(message, true, 'removeRSS')
  // },{
  //   name: "rssmessage",
  //   desc: "Open a menu to customize a feed's text message.",
  //   execute: rssPrintList(message, true, 'customMessage')
  // },{
  //   name: "rssembed",
  //   desc: "Open a menu to customzie a feed's embed message. This will replace the normal embed Discord usually sends when a link is posted.",
  //   execute: rssPrintList(message, true, 'customEmbed')
  // },{
  //   name: "rssfilteradd",
  //   desc: "Opens a menu to add filters.",
  //   execute: rssPrintList(message, true, 'filterAdd')
  // },{
  //   name: "rssfilterremove",
  //   desc: "Opens a menu to remove filters.",
  //   execute: rssPrintList(message, true, 'filterRemove')
  // },{
  //   name: "rsstest",
  //   desc: "Opens a menu to send a test message for a specific feed, along with the available properties and tags for customization.",
  //   execute: rssPrintList(message, true, 'testRSS')
  // }]}

  if (justChecking) {
    //for (let x in cmdList.commands)
      if (cmdList.hasOwnProperty(command)) return true;
  }

  if (!justChecking) {
    //for (let x in cmdList.commands)
      if (cmdList.hasOwnProperty(command)) {
        //console.log("hey"); return;
        return cmdList[command].execute;
      }
  }
}

const fs = require('fs')
const path = require('path')
const Command = require('../structs/Command.js')
const messageHandler = require('../events/message.js')
const eventHandlers = []

exports.createManagers = (bot) => {
  const fileNames = fs.readdirSync(path.join(__dirname, '..', 'events'))
  for (const fileName of fileNames) {
    const eventName = fileName.replace('.js', '')
    if (eventName === 'message') {
      continue
    }
    const eventHandler = require(`../events/${fileName}`)
    eventHandlers.push({ name: eventName, func: eventHandler })
    bot.on(eventName, eventHandler)
  }
}

exports.enableCommands = async (bot) => {
  eventHandlers.push({ name: 'message', func: messageHandler })
  bot.on('message', messageHandler)
  Command.enable()
}

exports.disableAll = (bot) => {
  for (const eventHandler of eventHandlers) {
    bot.removeListener(eventHandler.name, eventHandler.func)
  }
  eventHandlers.length = 0
  Command.disable()
}

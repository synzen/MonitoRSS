const getConfig = require('../config.js').get

/**
 * 1 = disable commands and message sending, heapdump
 * 2 = disable message listener
 * 3 = disable cycle database usage
 * 4 = disable cycles
 */

/**
 * @returns {number}
 */
exports.getDevLevel = (config) => {
  if (!config) {
    config = getConfig()
  }
  return config.dev
}

exports.devMinimum = (level) => (config) => {
  const devLevel = exports.getDevLevel(config)
  return devLevel >= level
}

exports.dumpHeap = exports.devMinimum(1)
exports.disableCommands = exports.devMinimum(1)
exports.disableOutgoingMessages = exports.devMinimum(1)
exports.disableMessageListener = exports.devMinimum(2)
exports.disableCycleDatabase = exports.devMinimum(3)
exports.disableCycles = exports.devMinimum(4)

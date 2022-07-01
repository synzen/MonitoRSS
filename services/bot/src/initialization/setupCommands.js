const Profile = require('../structs/db/Profile.js')
const Command = require('../structs/Command.js')

async function setupCommands (disableCommands) {
  await Profile.populatePrefixes()
  await Command.initialize()
  if (disableCommands) {
    Command.disable()
  } else {
    Command.enable()
  }
}

module.exports = setupCommands

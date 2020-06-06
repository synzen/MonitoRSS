const Profile = require('../structs/db/Profile.js')
const Command = require('../structs/Command.js')

async function setupCommands () {
  await Profile.populatePrefixes()
  await Command.initialize()
}

module.exports = setupCommands

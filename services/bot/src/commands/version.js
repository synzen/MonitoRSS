const fs = require('fs')
const path = require('path')
const packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json')))

module.exports = async (message, command) => {
  await message.channel.send(packageJSON.version)
}

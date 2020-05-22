const Patron = require('../../structs/db/Patron.js')
const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  await Patron.refresh()
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, 'Refreshed VIPs')
  await message.channel.send('Refreshed VIPs.')
}

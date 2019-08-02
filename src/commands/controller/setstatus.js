const log = require('../../util/logger.js')
const VALID_STATUS = ['online', 'idle', 'invisible', 'dnd']

function getStatus (message) {
  const content = message.content.split(' ')
  if (content.length === 1) return undefined
  content.shift()
  return content.join(' ').trim()
}

exports.normal = async (bot, message) => {
  const status = getStatus(message)
  try {
    if (!VALID_STATUS.includes(status)) return await message.channel.send(`That is not a valid status (\`${status}\`). Must be one of the following: \`${VALID_STATUS.join('`, `')}\`. `)
    await bot.user.setStatus(status)
    await message.channel.send(`Successfully changed the status to \`${status}\`.`)
  } catch (err) {
    log.controller.warning('setstatus', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('setstatus', message.guild, err))
  }
}

exports.sharded = exports.normal

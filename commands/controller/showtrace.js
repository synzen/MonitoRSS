const log = require('../../util/logger.js')

function getVal (message) {
  const setting = message.content.split(' ')[1]
  return setting === '1' ? true : setting === '0' ? false : setting
}

exports.normal = async (bot, message) => {
  try {
    const val = getVal(message)
    if (typeof val !== 'boolean') return await message.channel.send(`Invalid setting (\`${val}\`). Must be \`1\` or \`0\`.`)
    log.showTrace(val)
    await message.channel.send(val === true ? `Error stack traces will now be shown.` : `Error stack traces will now be hidden.`)
  } catch (err) {
    log.controller.warning(`showtrace`, message.author, err, true)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('showtrace 1b', message.guild, err))
  }
}

exports.sharded = async (bot, message) => {
  try {
    const val = getVal(message)
    if (typeof val !== 'boolean') return await message.channel.send(`Invalid setting (\`${val}\`). Must be \`1\` or \`0\`.`)
    await bot.shard.broadcastEval(`
      const path = require('path');
      const appDir = path.dirname(require.main.filename);
      const log = require(appDir + '/util/logger.js');
      log.showTrace(${val})
    `)
    await message.channel.send(val === true ? `Error stack traces will now be shown.` : `Error stack traces will now be hidden.`)
  } catch (err) {
    log.controller.warning(`showtrace`, message.author, err, true)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('showtrace 1b', message.guild, err))
  }
}

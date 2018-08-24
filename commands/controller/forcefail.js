const log = require('../../util/logger.js')
const dataFromLink = require('./util/dataFromLink.js')
const dbOps = require('../../util/dbOps.js')
const storage = require('../../util/storage.js')

exports.normal = async (bot, message) => {
  try {
    const link = message.content.split(' ')[1]
    if (!link) return await message.channel.send('No link detected.')
    const results = await dataFromLink(bot, link)
    if (typeof storage.failedLinks[link] === 'string') return await message.channel.send('That link has already failed.')
    if (results.length === 0) return await message.channel.send('No guilds found with that link.')
    await dbOps.failedLinks.fail(link)
    await message.channel.send('Successfully failed a link.')
  } catch (err) {
    log.controller.warning('forceremove', message.guild, message.author, err)
  }
}

exports.sharded = exports.normal

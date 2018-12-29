const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  let found = false

  try {
    const guildRssList = await dbOps.guildRss.getAll()
    guildRssList.forEach(guildRss => {
      if (found) return
      const rssList = guildRss.sources
      for (var rssName in rssList) {
        if (rssName === content[1]) {
          found = guildRss.id
          return
        }
      }
    })
    if (!found) await message.channel.send(`Could not find any feeds with that rssName.`)
    else await message.channel.send(`Found guild ${found}.`)
  } catch (err) {
    log.controller.warning('feedguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('checklimits 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

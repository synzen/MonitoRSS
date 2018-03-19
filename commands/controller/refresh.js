const config = require('../../config.json')
const storage = require('../../util/storage.js')
const requestStream = require('../../rss/request.js')
const log = require('../../util/logger.js')
const dbOps = require('../../util/dbOps.js')

exports.normal = async (bot, message) => {
  const failedLinks = storage.failedLinks
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]

  try {
    if (config.feeds.failLimit === 0) return message.channel.send(`No fail limit has been set.`)
    if (typeof failedLinks[link] !== 'string') return message.channel.send('That is not a failed link.')

    requestStream(link, null, null, async (err) => {
      try {
        if (err) {
          log.controller.warning(`Unable to refresh feed link ${link}`, message.author, err)
          return await message.channel.send(`Unable to refresh feed. Reason:\n\`\`\`${err}\n\`\`\``)
        }
        dbOps.failedLinks.reset(link)
        await message.channel.send(`Successfully refreshed <${link}>.`)

        log.controller.info(`Link ${link} has been refreshed and will be back on cycle.`, message.author)
      } catch (err) {
        log.controller.warning('refresh 2', err)
      }
    })
  } catch (err) {
    log.controller.warning('refresh', err)
  }
}

exports.sharded = async (bot, message, Manager) => {
  const failedLinks = storage.failedLinks

  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]
  try {
    if (config.feeds.failLimit === 0) return message.channel.send(`No fail limit has been set.`)
    if (typeof failedLinks[link] !== 'string') return message.channel.send('That is not a failed link.')

    requestStream(link, null, null, async (err) => {
      try {
        if (err) {
          log.controller.warning(`Unable to refresh feed link ${link}`, message.author, err)
          return await message.channel.send(`Unable to refresh feed. Reason:\n\`\`\`${err}\n\`\`\``)
        }
        await bot.shard.broadcastEval(`
          delete require(require('path').dirname(require.main.filename) + '/util/storage.js').failedLinks['${link}'];
        `)
        dbOps.failedLinks.reset(link)
        await message.channel.send(`Successfully refreshed <${link}>.`)
      } catch (err) {
        log.controller.warning('refresh 2', err)
      }
    })
  } catch (err) {
    log.controller.warning('refresh', err)
  }
}

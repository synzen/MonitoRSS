const Discord = require('discord.js')
const storage = require('../storage.js')
const config = require('../../config.js')
const models = storage.models
const log = require('../logger.js')
const UPDATE_SETTINGS = { upsert: true, strict: true }
const FAIL_LIMIT = config.feeds.failLimit
const FIND_PROJECTION = '-_id -__v'
const dbOpsGuilds = require('./guilds.js')

exports._sendAlert = (link, message, skipProcessSend) => {
  if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) return process.send({ _drss: true, type: 'failedLinks._sendAlert', link: link, message: message, _loopback: true })
  dbOpsGuilds.getAll()
    .then(results => {
      results.forEach(guildRss => {
        const rssList = guildRss.sources
        if (!rssList) return
        for (var i in rssList) {
          const source = rssList[i]
          if (source.link !== link || config.dev === true) continue
          let sent = false
          if (Array.isArray(guildRss.sendAlertsTo)) { // Each array item is a user id
            const userIds = guildRss.sendAlertsTo
            userIds.forEach(userId => {
              const user = storage.bot.users.get(userId)
              if (user && typeof message === 'string' && message.includes('connection failure limit')) {
                sent = true
                user.send(`**ATTENTION** - Feed link <${link}> in channel <#${source.channel}> has reached the connection failure limit in server named \`${guildRss.name}\` with ID \`${guildRss.id}\`, and will not be retried until it is manually refreshed by this server, or another server using this feed. Use \`${guildRss.prefix || config.bot.prefix}rsslist\` in your server for more information.`).catch(err => log.general.warning(`Unable to send limit notice to user ${userId} for feed ${link} (a)`, user, err))
              } else if (user) {
                sent = true
                user.send(message).catch(err => log.general.warning(`Unable to send limit notice to user ${userId} for feed ${link} (b)`, user, err))
              }
            })
          }
          if (sent === false) {
            const channel = storage.bot.channels.get(source.channel)
            if (channel) { // The channel may not exist since this function is broadcasted to all shards
              const attach = channel.guild.me.permissionsIn(channel).has('ATTACH_FILES')
              const m = attach ? `${message}\n\nA backup for this server at this point in time has been attached in case this feed is subjected to forced removal in the future.` : message
              if (config.dev !== true) channel.send(m, attach ? new Discord.Attachment(Buffer.from(JSON.stringify(guildRss, null, 2)), `${channel.guild.id}.json`) : null).catch(err => log.general.warning(`Unable to send limit notice for feed ${link}`, channel.guild, channel, err))
            }
          }
        }
      })
    })
    .catch(err => log.general.warning(`Failed to query all profiles for _sendAlert for failed link ${link}`, err))
}

exports.get = async link => {
  if (!config.database.uri.startsWith('mongo')) return
  return models.FailedLink().findOne({ link }, FIND_PROJECTION).lean().exec()
}

exports.getMultiple = async links => {
  if (!config.database.uri.startsWith('mongo')) return []
  return models.FailedLink().find({ link: { $in: links } }, FIND_PROJECTION).lean().exec()
}

exports.getAll = async () => {
  if (!config.database.uri.startsWith('mongo')) return []
  return models.FailedLink().find({}, FIND_PROJECTION).lean().exec()
}

exports.increment = async link => {
  if (FAIL_LIMIT === 0 || !config.database.uri.startsWith('mongo')) return
  await storage.models.FailedLink().updateOne({ link: link }, { $inc: { count: 1 } }, UPDATE_SETTINGS).exec()
}

exports.fail = async link => {
  if (!config.database.uri.startsWith('mongo')) return
  if (config.feeds.failLimit === 0) throw new Error('Unable to fail a link when config.feeds.failLimit is 0')
  const now = new Date().toString()
  if (config.feeds.notifyFail === true) exports._sendAlert(link, `**ATTENTION** - Feed link <${link}> has reached the connection failure limit and will not be retried until it is manually refreshed by this server, or another server using this feed. See \`${config.bot.prefix}rsslist\` for more information.`)
  await storage.models.FailedLink().updateOne({ link: link }, { $set: { link: link, failed: now } }, UPDATE_SETTINGS).exec()
  log.cycle.error(`${link} has been failed and will no longer be retrieved on subsequent retrieval cycles`)
}

exports.reset = async link => {
  if (!config.database.uri.startsWith('mongo')) return
  await storage.models.FailedLink().deleteOne({ link: link })
}

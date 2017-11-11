const fs = require('fs')
const config = require('../../config.json')
const storage = require('../../util/storage.js')
const requestStream = require('../../rss/request.js')

exports.normal = function (bot, message) {
  const failedLinks = storage.failedLinks

  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]

  if (config.feedSettings.failLimit === 0) return message.channel.send(`No fail limit has been set.`)
  if (typeof failedLinks[link] !== 'string') return message.channel.send('That is not a failed link.')

  requestStream(link, null, null, function (err) {
    if (err) {
      console.log(`Bot Controller: Unable to refresh feed link ${link} by (${message.author.id}, ${message.author.username}). `, err.message || err)
      return message.channel.send(`Unable to refresh feed. Reason:\n\`\`\`${err}\n\`\`\``)
    }
    delete storage.failedLinks[link]
    try {
      fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2))
      message.channel.send(`Successfully refreshed <${link}>.`)
    } catch (e) {
      console.log(`Bot Controller: Unable to update failedLinks.json from refresh. `, e.message || e)
      message.channel.send(`Successfully refreshed <${link}>, but was unable to write to file failedLinks. `, e.message || e)
    }
    console.log(`Bot Controller: Link ${link} has been refreshed by (${message.author.id}, ${message.author.username}), and will be back on cycle.`)
  })
}

exports.sharded = function (bot, message, Manager) {
  const failedLinks = storage.failedLinks

  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]
  if (config.feedSettings.failLimit === 0) return message.channel.send(`No fail limit has been set.`)
  if (typeof failedLinks[link] !== 'string') return message.channel.send('That is not a failed link.')

  requestStream(link, null, null, function (err) {
    if (err) {
      console.log(`Bot Controller: Unable to refresh feed link ${link} by (${message.author.id}, ${message.author.username}). `, err.message || err)
      return message.channel.send(`Unable to refresh feed. Reason:\n\`\`\`${err}\n\`\`\``)
    }
    bot.shard.broadcastEval(`
      delete require(require('path').dirname(require.main.filename) + '/util/storage.js').failedLinks['${link}'];
    `).then(() => {
      try {
        fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2))
        message.channel.send(`Successfully refreshed <${link}>.`)
      } catch (e) {
        console.log(`Bot Controller: Unable to update failedLinks.json from refresh after eval broadcast. `, e.message || e)
        message.channel.send(`Successfully refreshed <${link}>, but was unable to write to file failedLinks. `, e.message || e)
      }
    }).catch(err => console.log(`Bot Controller: Unable to broadcast eval refresh. `, err.message || err))
  })
}

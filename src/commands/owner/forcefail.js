const log = require('../../util/logger.js')
const Feed = require('../../structs/db/Feed.js')
const FailCounter = require('../../structs/db/FailCounter.js')

exports.normal = async (bot, message) => {
  try {
    const url = message.content.split(' ')[1]
    if (!url) {
      return await message.channel.send('No link detected.')
    }
    const randomFeed = await Feed.getBy('url', url)
    if (!randomFeed) {
      return await message.channel.send('No feeds found with that link.')
    }
    const counter = await FailCounter.getBy('url', url)
    if (counter) {
      if (counter.hasFailed()) {
        return await message.channel.send(`This URL has already failed (dated ${counter.failedAt}).`)
      }
      await counter.fail(`Forced failure by owner ${message.author.id} (${message.author.username})`)
    } else {
      const data = {
        url
      }
      const newCounter = new FailCounter(data)
      await newCounter.fail(`Forced failure by owner ${message.author.id} (${message.author.username})`)
    }
    await message.channel.send('Successfully failed the link.')
  } catch (err) {
    log.owner.warning('forceremove', message.guild, message.author, err)
  }
}

exports.sharded = exports.normal

const Feed = require('../../structs/db/Feed.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const feedID = content[1]
  const feed = await Feed.get(feedID)
  if (!feed) {
    return message.channel.send('Could not find any feeds with that id.')
  }
  return message.channel.send(`Found guild ${feed.guild}`)
}

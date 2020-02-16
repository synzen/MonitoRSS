/*
* Used to generate a list of roles that are both lower than the bot's role, and subscribed to feeds
* Returns the feed source and the role list
*/

module.exports = async (guild, feeds) => {
  let finalList = []
  const botRole = guild.members.cache.get(guild.client.user.id).roles.highest
  const subscribers = await Promise.all(feeds.map(feed => feed.getSubscribers()))

  subscribers.forEach((feedSubscribers, index) => {
    if (feedSubscribers.length === 0) {
      return
    }
    const feed = feeds[index]
    const subscribersFound = []
    for (const subscriber of feedSubscribers) {
      if (subscriber.type === 'role') {
        const role = guild.roles.cache.get(subscriber.id)
        if (role && role.comparePositionTo(botRole) < 0) {
          subscribersFound.push(role.id)
        }
      }
    }

    if (subscribersFound.length !== 0) {
      finalList.push({
        source: feed,
        roleList: subscribersFound
      })
    }
  })

  if (finalList.length === 0) return null
  return finalList
}

/*
* Used to generate a list of roles that are both lower than the bot's role, and subscribed to feeds
* Returns the feed source and the role list
*/

module.exports = (guild, rssList) => {
  let finalList = []
  const botRole = guild.members.get(guild.client.user.id).highestRole
  for (var rssName in rssList) {
    let subscribersFound = []
    const source = rssList[rssName]
    const subscribers = source.subscribers
    if (!Array.isArray(subscribers) || subscribers.length === 0) continue
    for (const subscriber of subscribers) {
      if (subscriber.type === 'role') {
        const role = guild.roles.get(subscriber.id)
        if (role.comparePositionTo(botRole) < 0) subscribersFound.push(role.id)
      }
    }

    if (subscribersFound.length !== 0) finalList.push({ source: rssList[rssName], roleList: subscribersFound })
  }

  if (finalList.length === 0) return null
  return finalList
}

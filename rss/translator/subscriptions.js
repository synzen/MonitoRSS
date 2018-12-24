const testFilters = require('./filters.js')

module.exports = (source, article) => {
  let mentions = ''
  const ids = [] // Used for role mention toggling

  // Get global subscriptions
  const subTypes = ['roleSubscriptions', 'userSubscriptions']
  subTypes.forEach((key, i) => {
    const globalSubList = source[key]
    if (!globalSubList) return
    for (const item in globalSubList) {
      const id = globalSubList[item].id
      mentions += i === 0 ? `<@&${id}> ` : `<@${id}> `
      if (i === 0) ids.push(id)
    }
  })

  // Get filtered subscriptions
  if (source.filters) {
    if (source.filters.roleSubscriptions) {
      const subscribedRoles = source.filters.roleSubscriptions
      for (const id in subscribedRoles) {
        if (subscribedRoles[id].filters && testFilters(subscribedRoles[id], article).passed) mentions += `<@&${id}> `
        ids.push(id)
      }
    }
    if (source.filters.userSubscriptions) {
      const subscribedUsers = source.filters.userSubscriptions
      for (const id in subscribedUsers) {
        if (subscribedUsers[id].filters && testFilters(subscribedUsers[id], article).passed) mentions += `<@${id}> `
      }
    }
  }

  return { mentions, ids }
}

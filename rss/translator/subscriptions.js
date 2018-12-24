const testFilters = require('./filters.js')

module.exports = (source, article) => {
  let mentions = ''
  const ids = [] // Used for role mention toggling

  // Get global subscriptions
  if (source.roleSubscriptions) {
    const globalSubList = source.roleSubscriptions
    for (const role in globalSubList) {
      const id = globalSubList[role].roleID
      mentions += `<@&${id}> `
      ids.push(id)
    }
  }
  if (source.userSubscriptions) {
    const globalSubList = source.userSubscriptions
    for (const user in globalSubList) {
      const id = globalSubList[user].userID
      mentions += `<@${id}> `
      ids.push(id)
    }
  }

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

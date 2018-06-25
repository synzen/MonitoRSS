const testFilters = require('./filters.js')

module.exports = (source, article) => {
  let mentions = ''
  const ids = []

  // Get global subscriptions
  if (source.roleSubscriptions) {
    const globalSubList = source.roleSubscriptions
    for (let role in globalSubList) {
      const id = globalSubList[role].roleID
      mentions += `<@&${id}> `
      ids.push(id)
    }
  }

  // Get filtered subscriptions
  if (source.filters && source.filters.roleSubscriptions) {
    const subscribedRoles = source.filters.roleSubscriptions
    for (let id in subscribedRoles) {
      if (subscribedRoles[id].filters && testFilters(subscribedRoles[id], article).passed) mentions += `<@&${id}> `
      ids.push(id)
    }
  }

  return { mentions, ids }
}

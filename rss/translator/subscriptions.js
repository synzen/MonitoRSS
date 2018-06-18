const testFilters = require('./filters.js')

module.exports = (source, article) => {
  let mentions = ''

  // Get global subscriptions
  if (source.roleSubscriptions) {
    const globalSubList = source.roleSubscriptions
    for (let role in globalSubList) {
      mentions += `<@&${globalSubList[role].roleID}> `
    }
  }

  // Get filtered subscriptions
  if (source.filters && source.filters.roleSubscriptions) {
    const subscribedRoles = source.filters.roleSubscriptions
    for (let role in subscribedRoles) {
      if (subscribedRoles[role].filters && testFilters(subscribedRoles[role], article).passed) mentions += `<@&${role}> `
    }
  }

  return mentions
}

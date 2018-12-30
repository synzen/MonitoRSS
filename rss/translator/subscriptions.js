const testFilters = require('./filters.js')

module.exports = (source, article) => {
  let mentions = ''
  const ids = [] // Used for role mention toggling

  // Get global subscriptions
  const globalSubscriptions = source.globalSubscriptions
  if (globalSubscriptions) {
    for (const subscriber of globalSubscriptions) {
      const type = subscriber.type
      const id = subscriber.id
      if (type === 'user') mentions += `<@${id}>`
      else if (type === 'role') {
        mentions += `<@&${id}>`
        ids.push(id) // For ArticleMessage mention toggling
      }
    }
  }

  // Get filtered subscriptions
  const filteredSubscriptions = source.filteredSubscriptions
  if (filteredSubscriptions) {
    for (const subscriber of filteredSubscriptions) {
      const type = subscriber.type
      if (type !== 'role' && type !== 'user') continue
      if (subscriber.filters && testFilters(subscriber, article).passed) mentions += type === 'role' ? `<@&${subscriber.id}> ` : `<@${subscriber.id}> `
      if (type === 'role') ids.push(subscriber.id) // For ArticleMessage mention toggling
    }
  }

  return { mentions, ids }
}

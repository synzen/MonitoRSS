const VERSION = '5.0.1'

function updateGuildRss (guildRss) {
  const rssList = guildRss.sources
  let changed = false
  if (guildRss.sendAlertsTo && guildRss.sendAlertsTo.length === 0) {
    delete guildRss.sendAlertsTo
    changed = true
  }

  for (const rssName in rssList) {
    const newRssName = rssName.replace(/[^a-zA-Z0-9-_]/g, '') // Make it URI-friendly
    if (newRssName !== rssName) {
      Object.defineProperty(rssList, newRssName, Object.getOwnPropertyDescriptor(rssList, rssName))
      delete rssList[rssName]
      changed = true
    }

    if (!guildRss.version || guildRss.version !== VERSION) {
      guildRss.version = VERSION
      changed = true
    }
  }

  return changed
}

exports.updateGuildRss = updateGuildRss
exports.rerun = true

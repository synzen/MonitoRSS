const fs = require('fs')

const dir = fs.readdirSync('./sources')

function len(obj) {
  for (var q in obj) {
    return true
  }
}
if (dir.length === 0) return

if (!fs.existsSync('./newSources')) fs.mkdirSync('./newSources')
for (var x in dir) {
  const guildRss = JSON.parse(fs.readFileSync(`./sources/${dir[x]}`))
  const sources = guildRss.sources
  if (typeof sources === 'object' && !Array.isArray(sources)) {
    const newSources = {}
    for (var rssName in sources) {
      let newRssName = rssName.replace(/\./g, '')
      newSources[newRssName] = sources[rssName]
    }
    guildRss.sources = newSources
    fs.writeFileSync(`./newSources/${dir[x]}`, JSON.stringify(guildRss, null, 2))
  } else fs.writeFileSync(`./newSources/${dir[x]}`, JSON.stringify(guildRss, null, 2))
}

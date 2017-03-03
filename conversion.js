/*

  If upgrading to newer files from before 3 March 2017, use this file
  to convert all profiles in the sources folder to the newer format.
  Otherwise ignore.

*/
const fs = require('fs')

fs.readdir('./sources', function (error, files) {
  console.log('Beginning conversion.')
  var count = 0;
  files.forEach(function(file) {
    count++
    console.log(`Processing file ${count} of ${files.length}`)
    if (!file.endsWith('.json')) return;
    var guildRss = require(`./sources/${file}`);
    if (!guildRss.sources || !Array.isArray(guildRss.sources)) return;
    let newSources = {};
    for (var rssIndex in guildRss.sources) {
      let sourceKey = guildRss.sources[rssIndex].name;
      delete guildRss.sources[rssIndex].name;
      newSources[sourceKey] = guildRss.sources[rssIndex];
    }
    guildRss.sources = newSources;
    fs.writeFileSync(`./sources/${file}`, JSON.stringify(guildRss, null, 2));
  })
  console.log('Completed conversion.')

})

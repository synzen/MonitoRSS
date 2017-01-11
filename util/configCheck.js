
module.exports = function (guildIndex, rssIndex, logging, initializing) {

  var rssConfig = require('../config.json')
  var rssList = rssConfig.sources[guildIndex]

  var valid = true;

  if (rssConfig.defaultMessage == null || rssConfig.defaultMessage == "") {
    console.log(`RSS Config Warning: A default message must be set in config before continuing.`);
    return false;
  }
  else if (rssList[rssIndex].enabled == 0) {
    if (logging && initializing) console.log(`RSS Config Info: Feed "${rssList[rssIndex].name}" is disabled in channel ${rssList[rssIndex].channel}, skipping...`);
    return false;
  }

  if ((rssList[rssIndex].name == null || rssList[rssIndex].name == "") && rssList.length !== 0){
    if (logging) console.log(`RSS Config Warning: Feed #${parseInt(rssIndex,10) + 1} has no name defined, skipping...`);
    valid = false;
  }
  else if (rssList[rssIndex].link == null || !rssList[rssIndex].link.startsWith("http")){
    if (logging) console.log(`RSS Config Warning: ${rssList[rssIndex].name} has no valid link defined, skipping...`);
    valid = false;
  }
  else if (rssList[rssIndex].channel == null) {
    if (logging) console.log(`RSS Config Warning: ${rssList[rssIndex].name} has no channel defined, skipping...`);
    valid = false;
  }
  // else if (rssList[rssIndex].message == null){
  //   if (logging && initializing) console.log(`RSS Config Info: ${rssList[rssIndex].name} has no Message defined, using default message...`);
  //   valid = true;
  // }

  return valid;

}

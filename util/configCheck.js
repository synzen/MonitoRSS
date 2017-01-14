
module.exports = function (rssList, rssIndex, logging, initializing) {

  var rssConfig = require('../config.json')

  var valid = true;

  if (rssConfig.defaultMessage == null || rssConfig.defaultMessage == "") {
    console.log(`RSS Config Warning: A default message must be set in config before continuing.`);
    return false;
  }
  else if (rssList[rssIndex].source.enabled == 0) {
    if (logging && initializing) console.log(`RSS Config Info: ${rssList[rssIndex].guild} => Feed "${rssList[rssIndex].source.name}" is disabled in channel ${rssList[rssIndex].source.channel}, skipping...`);
    return false;
  }

  if ((rssList[rssIndex].source.name == null || rssList[rssIndex].source.name == "") && rssList.length !== 0){
    if (logging) console.log(`RSS Config Warning: ${rssList[rssIndex].guild} => Feed #${parseInt(rssIndex,10) + 1} has no name defined, skipping...`);
    valid = false;
  }
  else if (rssList[rssIndex].source.link == null || !rssList[rssIndex].source.link.startsWith("http")){
    if (logging) console.log(`RSS Config Warning: ${rssList[rssIndex].guild} => ${rssList[rssIndex].source.name} has no valid link defined, skipping...`);
    valid = false;
  }
  else if (rssList[rssIndex].source.channel == null) {
    if (logging) console.log(`RSS Config Warning: ${rssList[rssIndex].guild} => ${rssList[rssIndex].source.name} has no channel defined, skipping...`);
    valid = false;
  }
  // else if (rssList[rssIndex].source.message == null){
  //   if (logging && initializing) console.log(`RSS Config Info: ${rssList[rssIndex].source.name} has no Message defined, using default message...`);
  //   valid = true;
  // }

  return valid;

}

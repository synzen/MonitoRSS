const striptags = require('striptags')

function foundFilterWords(filterType, content) {

  //filterType is title, description, summary, or author

  if (content == null) return false;
  var content = content.toLowerCase();
  if (filterType != null && filterType.length !== 0) {
    if (typeof filterType == "object") {
      for (var word in filterType)
        if (content.search(filterType[word].toLowerCase()) !== -1)
          return true;
    }
    else if (typeof filterType == "string") {
      if (content.search(filterType.toLowerCase()) !== -1)
        return true;
    }
  }
  else return false;
}


module.exports = function (rssList, rssIndex, data, dataDescrip) {

  var filterFound = false

  let titleFilters = rssList[rssIndex].filters.Title;
  if (foundFilterWords(titleFilters, data.title))
    filterFound = true;

  let descrFilters = rssList[rssIndex].filters.Description;
  if (foundFilterWords(descrFilters, dataDescrip))
    filterFound = true;

  let smryFilters = rssList[rssIndex].filters.Summary;
  if (foundFilterWords(smryFilters, striptags(data.summary)))
    filterFound = true;

  let authorFilters = rssList[rssIndex].filters.Author;
  if (foundFilterWords(authorFilters, striptags(data.author)))
    filterFound = true;

  if (data.guid.startsWith("yt:video")) {
    if (foundFilterWords(descrFilters, data['media:group']['media:description']['#']))
      filterFound = true;
  }

  return filterFound

}

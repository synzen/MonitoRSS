const striptags = require('striptags')

function foundFilterWords(filterType, content) {

  //filterType is title, description, summary, or author

  if (!content) return false;
  var content = content.toLowerCase();
  if (filterType && filterType.length !== 0) {
    if (typeof filterType === "object") {
      for (var word in filterType)
        if (content.search(filterType[word].toLowerCase()) !== -1)
          return true;
    }
    else if (typeof filterType === "string") {
      if (content.search(filterType.toLowerCase()) !== -1)
        return true;
    }
  }
  else return false;
}


module.exports = function (rssList, rssIndex, article) {

  var filterFound = false

  let titleFilters = rssList[rssIndex].filters.Title;
  if (foundFilterWords(titleFilters, article.title))
    filterFound = true;

  let descrFilters = rssList[rssIndex].filters.Description;
  if (foundFilterWords(descrFilters, article.description))
    filterFound = true;

  let smryFilters = rssList[rssIndex].filters.Summary;
  if (foundFilterWords(smryFilters, article.rawSummary))
    filterFound = true;

  let authorFilters = rssList[rssIndex].filters.Author;
  if (foundFilterWords(authorFilters, article.author))
    filterFound = true;

  return filterFound

}

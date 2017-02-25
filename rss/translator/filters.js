const striptags = require('striptags')

module.exports = function (rssList, rssIndex, article, isTestMessage) {

  function findFilterWords(filterType, content) {
    //filterType is array of title, description, summary, or author
    if (!content) return false;
    if (isTestMessage) var matches = []

    var content = content.toLowerCase();
    if (filterType && filterType.length !== 0 && typeof filterType === 'object') {
      for (var word in filterType) {
        let expression = new RegExp(`(\\s|^)${word}(\\s|$)`, 'gi');
        if (expression.test(content)) {
          if (isTestMessage) matches.push(filterType[word]);
          else return true;
        }
      }
    }
    else return false;
    if (isTestMessage) {
      if (matches.length === 0) return false;
      else return matches;
    }
  }

  var filterFound = ''
  var filterTypes = {'Title': {
                      user: rssList[rssIndex].filters.Title,
                      ref: article.title
                      },
                    'Descriptipn': {
                      user: rssList[rssIndex].filters.Description,
                      ref: article.rawDescrip
                      },
                    'Summary': {
                      user: rssList[rssIndex].filters.Summary,
                      ref: article.rawSummary
                      },
                    'Author': {
                      user: rssList[rssIndex].filters.Author,
                      ref: article.author
                      }
                    }

  for (var type in filterTypes) {
    let foundList = findFilterWords(filterTypes[type].user, filterTypes[type].ref);
    if (foundList && isTestMessage) {
      var list = '';
      for (var x in foundList) {
        list += ` ${foundList[x]}`;
        if (x !== foundList.length - 1) list += ' |'
      }
      filterFound += `\n${type}:${list}`;
    }
    else if (foundList) filterFound = true;
  }

  return filterFound

}

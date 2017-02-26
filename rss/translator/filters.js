const striptags = require('striptags')

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function findFilterWords(filterType, content, isTestMessage) {
  //filterType is array of title, description, summary, or author
  if (!content) return false;
  if (isTestMessage) var matches = []
  if (filterType && filterType.length !== 0 && typeof filterType === 'object') {
    if (typeof content === 'string') {
      var content = content.toLowerCase();
      for (var word in filterType) {
        let expression = new RegExp(`(\\s|^)${escapeRegExp(filterType[word])}(\\s|$)`, 'gi');
        if (expression.test(content)) {
          if (isTestMessage) matches.push(filterType[word]);
          else return true;
        }
      }
    }
    else if (typeof content === 'object') {
      for (var item in content) {
        for (var word in filterType) {
          if (`'${filterType[word].toLowerCase()}'` == content[item].toLowerCase().trim()) {
            if (isTestMessage) matches.push(filterType[word]);
            else return true;
          }
        }
      }
    }
  }
  else return false;
  if (isTestMessage) {
    if (matches.length === 0) return false;
    else return matches;
  }
}

module.exports = function (rssList, rssIndex, article, isTestMessage) {

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
                      },
                    'Tags': {
                      user: rssList[rssIndex].filters.Tag,
                      ref: article.tags.split(', ')
                      }
                    }

  for (var type in filterTypes) {
    let foundList = findFilterWords(filterTypes[type].user, filterTypes[type].ref);
    if (foundList && isTestMessage) {
      var list = '';
      for (var x in foundList) {
        list += ` ${foundList[x]}`;
        if (x != foundList.length - 1) list += ' |'
      }
      filterFound += `\n${type}:${list}`;
    }
    else if (foundList) filterFound = true;
  }

  return filterFound

}

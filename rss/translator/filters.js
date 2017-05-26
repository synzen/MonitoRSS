// http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp (str) {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}

function findFilterWords (filterType, content, isTestMessage) {
  // filterType is array of title, description, summary, or author
  if (!content) return false
  if (isTestMessage) var matches = []
  if (filterType && typeof filterType === 'object' && filterType.length && filterType.length !== 0) {
    // For title, descriptions, summary, and author
    if (typeof content === 'string') {
      content = content.toLowerCase()
      for (var word in filterType) {
        let searchTerm
        // Broad filters, for phrases/words found anywhere
        if (filterType[word].startsWith('~')) {
          searchTerm = filterType[word].slice(1, filterType[word].length)
          var expression = new RegExp(`${escapeRegExp(searchTerm)}`, 'gi')
          if (content.search(expression) !== -1) {
            if (isTestMessage) matches.push(filterType[word])
            else return true
          }
        } else { // Specific filters, for phrases/words with spaces around them
          searchTerm = (filterType[word].startsWith('\\~')) ? filterType[word].slice(1, filterType[word].length) : filterType[word] // A slash-tilde (\~) will just read as a ~ to prevent broad filter
          let expression = new RegExp(`(\\s|^)${escapeRegExp(searchTerm)}(\\s|$)`, 'gi')
          if (expression.test(content)) {
            if (isTestMessage) matches.push(filterType[word])
            else return true
          }
        }
      }
    } else if (typeof content === 'object') { // For tags
      for (var item in content) {
        for (var w in filterType) {
          if (filterType[w].toLowerCase() === content[item].toLowerCase().trim()) {
            if (isTestMessage) matches.push(filterType[w])
            else return true
          }
        }
      }
    }
  } else return false
  if (isTestMessage) {
    if (matches.length === 0) return false
    else return matches
  }
}

module.exports = function (rssList, rssName, article, isTestMessage) {
  var filterFound = ''
  var filterTypes = {
    'Title': {
      user: rssList[rssName].filters.Title,
      ref: article.title
    },
    'Descriptipn': {
      user: rssList[rssName].filters.Description,
      ref: article.rawDescrip
    },
    'Summary': {
      user: rssList[rssName].filters.Summary,
      ref: article.rawSummary
    },
    'Author': {
      user: rssList[rssName].filters.Author,
      ref: article.author
    },
    'Tags': {
      user: rssList[rssName].filters.Tag,
      ref: article.tags.split('\n')
    }
  }

  for (var type in filterTypes) {
    let foundList = findFilterWords(filterTypes[type].user, filterTypes[type].ref, isTestMessage)
    if (foundList && isTestMessage) {
      var list = ''
      for (var x in foundList) {
        list += ` ${foundList[x]}`
        if (parseInt(x, 10) !== foundList.length - 1) list += ' |'
      }
      filterFound += `\n${type}:${list}`
    } else if (foundList) filterFound = true
  }

  return filterFound
}

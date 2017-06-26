// http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp (str) {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}

function findFilterWords (filterType, content, isTestMessage) {
  // filterType is array of title, description, summary, or author
  if (!content) return false
  if (isTestMessage) var matches = []

  let invertedFilter = false // Inverted results = NOT filters found
  if (typeof filterType === 'object' && filterType.length && filterType.length !== 0) {
    // For title, descriptions, summary, and author
    if (typeof content === 'string') {
      content = content.toLowerCase()
      for (var word in filterType) {
        let searchTerm = filterType[word]

        if (searchTerm.startsWith('!')) {
          invertedFilter = true
          searchTerm = searchTerm.slice(1, searchTerm.length)
        }

        if (searchTerm.startsWith('~')) { // Broad filters, for phrases/words found anywhere
          searchTerm = searchTerm.slice(1, searchTerm.length)
          if (content.includes(searchTerm)) {
            if (isTestMessage) matches.push(filterType[word])
            else if (!invertedFilter) return true
            else return false
          }
        } else { // Specific filters, for phrases/words with spaces around them
          searchTerm = (searchTerm.startsWith('\\~')) ? searchTerm.slice(1, searchTerm.length) : searchTerm.startsWith('\!') ? searchTerm.slice(1, searchTerm.length) : searchTerm // A \~ or \! will just read as a ~ or !
          let expression = new RegExp(`(\\s|^)${escapeRegExp(searchTerm)}(\\s|$)`, 'gi')
          if (content.search(expression) !== -1) {
            if (isTestMessage) matches.push(filterType[word])
            else if (!invertedFilter) return true
            else return false
          }
        }
      }
    } else if (typeof content === 'object') { // For tags
      for (var item in content) {
        for (var w in filterType) {
          let searchTerm = filterType[w]

          if (searchTerm.startsWith('!')) {
            invertedFilter = true
            searchTerm = searchTerm.slice(1, searchTerm.length)
          }

          if (searchTerm.startsWith('~')) { // Broad filters, for phrases/words found anywhere
            searchTerm = searchTerm.slice(1, searchTerm.length)
            if (content[item].includes(searchTerm)) {
              if (isTestMessage) matches.push(filterType[w])
              else if (!invertedFilter) return true
              else return false
            }
          } else { // Specific filters, for phrases/words with spaces around them
            searchTerm = (searchTerm.startsWith('\\~')) ? searchTerm.slice(1, searchTerm.length) : searchTerm.startsWith('\!') ? searchTerm.slice(1, searchTerm.length) : searchTerm // A \~ or \! will just read as a ~ or !
            let expression = new RegExp(`(\\s|^)${escapeRegExp(searchTerm)}(\\s|$)`, 'gi')
            if (content[item].search(expression) !== -1) {
              if (isTestMessage) matches.push(filterType[w])
              else if (!invertedFilter) return true
              else return false
            }
          }
          // if (filterType[w].toLowerCase() === content[item].toLowerCase().trim()) {
          //   if (isTestMessage) matches.push(filterType[w])
          //   else return true
          // }
        }
      }
    }
  } else return false

  if (isTestMessage) {
    return {
      inverted: invertedFilter,
      matches: matches.length > 0 ? matches : null
    }
  }
  else if (invertedFilter) return true
  else return false
}

module.exports = function (rssList, rssName, article, isTestMessage) {
  let filterTypes = {
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

  let passedFilters = false
  let filterMatches = ''
  for (var type in filterTypes) {
    let results = findFilterWords(filterTypes[type].user, filterTypes[type].ref, isTestMessage)
    if (isTestMessage) {
      if (results.matches) {
        var list = ''
        for (var x in results.matches) {
          list += ` ${results.matches[x]}`
          if (parseInt(x, 10) !== results.matches.length - 1) list += ' |'
        }
        filterMatches += `\n${type}:${list}`
        if (!results.inverted) passedFilters = true
      }
      if (results.inverted && !results.matches) passedFilters = true
    } else if (results === true) passedFilters = true
  }

  if (isTestMessage) return {
    passedFilters: passedFilters,
    filterMatches: filterMatches
  }
  else return passedFilters
}

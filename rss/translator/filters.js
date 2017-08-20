// http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp (str) {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}

function findFilterWords (filterType, content, isTestMessage) {
  // filterType is array of title, description, summary, or author
  if (!content) return {passed: false, inverted: false}
  if (isTestMessage) {
    var matches = []
    var invertedMatches = []
  }
  const results = []

  if (typeof filterType === 'object' && filterType.length && filterType.length !== 0) {
    // For title, descriptions, summary, and author
    if (typeof content === 'string') {
      content = content.toLowerCase()
      for (var word in filterType) {
        let invertedFilter = false // Inverted results = NOT filters found
        let searchTerm = filterType[word].toLowerCase()
        if (searchTerm.startsWith('!')) {
          invertedFilter = true
          searchTerm = searchTerm.slice(1, searchTerm.length)
        }

        if (searchTerm.startsWith('~')) { // Broad filters, for phrases/words found anywhere
          searchTerm = searchTerm.slice(1, searchTerm.length)
          if (content.includes(searchTerm)) {
            if (isTestMessage && !invertedFilter) matches.push(filterType[word])
            else if (isTestMessage && invertedFilter) invertedMatches.push(filterType[word])
            results.push({passed: true, inverted: invertedFilter})
          } else results.push({passed: false, inverted: invertedFilter})
        } else { // Specific filters, for phrases/words with spaces around them
          searchTerm = (searchTerm.startsWith('\\~')) ? searchTerm.slice(1, searchTerm.length) : searchTerm.startsWith('!') ? searchTerm.slice(1, searchTerm.length) : searchTerm // A \~ or \! will just read as a ~ or !
          let expression = new RegExp(`(\\s|^)${escapeRegExp(searchTerm)}(\\s|$)`, 'gi')
          if (content.search(expression) !== -1) {
            if (isTestMessage && !invertedFilter) matches.push(filterType[word])
            else if (isTestMessage && invertedFilter) invertedMatches.push(filterType[word])
            results.push({passed: true, inverted: invertedFilter})
          } else results.push({passed: false, inverted: invertedFilter})
        }
      }
    } else if (typeof content === 'object') { // For tags
      for (var item in content) {
        for (var w in filterType) {
          let invertedFilter = false // Inverted results = NOT filters found
          let searchTerm = filterType[w]

          if (searchTerm.startsWith('!')) {
            invertedFilter = true
            searchTerm = searchTerm.slice(1, searchTerm.length)
          }

          if (searchTerm.startsWith('~')) { // Broad filters, for phrases/words found anywhere
            searchTerm = searchTerm.slice(1, searchTerm.length)
            if (content[item].includes(searchTerm)) {
              if (isTestMessage && !invertedFilter) matches.push(filterType[w])
              else if (isTestMessage && invertedFilter) invertedMatches.push(filterType[word])
              results.push({passed: true, inverted: invertedFilter})
            } else results.push({passed: false, inverted: invertedFilter})
          } else { // Specific filters, for phrases/words with spaces around them
            searchTerm = (searchTerm.startsWith('\\~')) ? searchTerm.slice(1, searchTerm.length) : searchTerm.startsWith('!') ? searchTerm.slice(1, searchTerm.length) : searchTerm // A \~ or \! will just read as a ~ or !
            let expression = new RegExp(`(\\s|^)${escapeRegExp(searchTerm)}(\\s|$)`, 'gi')
            if (content[item].search(expression) !== -1) {
              if (isTestMessage && !invertedFilter) matches.push(filterType[w])
              else if (isTestMessage && invertedFilter) invertedMatches.push(filterType[word])
              results.push({passed: true, inverted: invertedFilter})
            } else results.push({passed: false, inverted: invertedFilter})
          }
        }
      }
    }
  }

  if (isTestMessage) {
    return {
      resultsList: results,
      matches: matches.length > 0 ? matches : null,
      invertedMatches: invertedMatches.length > 0 ? invertedMatches : null
    }
  } else return {resultsList: results}
}

function FilterResults () {
  this.matches = {}
  this.invertedMatches = {}

  this.add = function (type, matches, inverted) {
    if (inverted) this.invertedMatches[type] = matches
    else this.matches[type] = matches
  }

  this.listMatches = function (inverted) {
    const matchList = inverted ? this.invertedMatches : this.matches
    let str = ''
    for (var type in matchList) {
      let list = ''
      const typeMatches = matchList[type]
      for (var x in typeMatches) {
        list += ` ${typeMatches[x]}`
        if (parseInt(x, 10) !== typeMatches.length - 1) list += ' |'
      }
      str += `\n${type}:${list}`
    }
    return str
  }
}

module.exports = function (rssList, rssName, article, isTestMessage) {
  let filterTypes = {
    'Title': {
      user: rssList[rssName].filters.Title,
      ref: article.title
    },
    'Description': {
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

  // Inverted and regular filters are ultimately calculated together with AND
  const passed = {
    invertedFilters: true, // If an inverted filter is found, invertedFilters is set to false for the AND operation
    regularFilters: true // If a regular filter is not found, regularFilters is set to true
  }
  let regularFiltersHasTrueInstance = false // Used for OR operation between regularFilters

  const filterResults = new FilterResults()
  for (var type in filterTypes) {
    const allResults = findFilterWords(filterTypes[type].user, filterTypes[type].ref, isTestMessage)
    // Get match words for test messages
    if (isTestMessage && allResults.matches) filterResults.add(type, allResults.matches, false)
    if (isTestMessage && allResults.invertedMatches) filterResults.add(type, allResults.invertedMatches, true)

    // Decide whether it passes for each filter
    for (var i in allResults.resultsList) {
      const results = allResults.resultsList[i]
      if (results.length === 0) continue

      // AND operation saved for future reference
      // if (results.inverted && results.passed === true) passed.invertedFilters = false
      // else if (!results.inverted && results.passed === false) passed.regularFilters = false

      // OR operation
      if (results.inverted && results.passed === true) passed.invertedFilters = false // Maintain the first line from the AND operation between NOT nad non-NOT
      else if (!results.inverted) {
        if (results.passed === false) passed.regularFilters = false // Only account for false since the default is true
        else if (results.passed === true) regularFiltersHasTrueInstance = true
      }
    }
  }

  if (regularFiltersHasTrueInstance) passed.regularFilters = true

  filterResults.passedFilters = passed.invertedFilters && passed.regularFilters
  if (isTestMessage) return filterResults
  else return passed.invertedFilters && passed.regularFilters
}

// http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp (str) {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}

function findFilterWords (filterType, content, isTestMessage) {
  // filterType is array of title, description, summary, or author
  if (isTestMessage) {
    var matches = []
    var invertedMatches = []
  }
  const results = []

  if (Array.isArray(filterType) && filterType.length > 0) {
    if (typeof content === 'string') { // For title, descriptions, summary, and author
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
          } else {
            results.push({passed: false, inverted: invertedFilter})
          }
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

  const passed = {   // Inverted and regular filters are ultimately calculated together with AND
    invertedFilters: true,
    regularFilters: false
  }
  let regularFiltersExists = false
  let invertedFiltersExists = false
  let userDefinedFiltersExists = false

  const filterResults = new FilterResults()
  for (var type in filterTypes) {
    if (filterTypes[type].user && filterTypes[type].user.length > 0) userDefinedFiltersExists = true
    const allResults = findFilterWords(filterTypes[type].user, filterTypes[type].ref, isTestMessage)
    // Get match words for test messages
    if (isTestMessage && allResults.matches) filterResults.add(type, allResults.matches, false)
    if (isTestMessage && allResults.invertedMatches) filterResults.add(type, allResults.invertedMatches, true)

    // Decide whether it passes for each filter, iterating through each search word's results
    for (var i in allResults.resultsList) {
      const results = allResults.resultsList[i]
      if (results.length === 0) continue

      if (results.inverted) {
        invertedFiltersExists = true
        if (results.passed === true) passed.invertedFilters = false
      } else if (!results.inverted) {
        regularFiltersExists = true
        if (results.passed === true) passed.regularFilters = true
      }
    }
  }

  if (!userDefinedFiltersExists || (!invertedFiltersExists && !regularFiltersExists)) {
    passed.invertedFilters = true
    passed.regularFilters = true
  } else if (userDefinedFiltersExists) {
    if (!invertedFiltersExists && regularFiltersExists) passed.invertedFilters = true
    else if (!regularFiltersExists && invertedFiltersExists) passed.regularFilters = true
  }

  filterResults.passedFilters = passed.invertedFilters && passed.regularFilters
  if (isTestMessage) return filterResults
  else return passed.invertedFilters && passed.regularFilters
}

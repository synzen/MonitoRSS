// http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp (str) {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}

class _FilterResults {
  constructor () {
    this.matches = {}
    this.invertedMatches = {}
  }

  add (type, matches, inverted) {
    if (inverted) this.invertedMatches[type] = matches
    else this.matches[type] = matches
  }

  listMatches (inverted) {
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

function findFilterWords (filterType, content) {
  // filterType is array of title, description, summary, or author

  // Vars for test message
  let matches = []
  let invertedMatches = []

  // Var for any message
  let results = []

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
            if (!invertedFilter) matches.push(filterType[word])
            else if (invertedFilter) invertedMatches.push(filterType[word])
            results.push({ passed: true, inverted: invertedFilter })
          } else results.push({ passed: false, inverted: invertedFilter })
        } else { // Specific filters, for phrases/words with spaces around them
          searchTerm = searchTerm.startsWith('\\~') ? searchTerm.slice(1, searchTerm.length) : searchTerm.startsWith('\\!') ? searchTerm.slice(1, searchTerm.length) : searchTerm // A \~ or \! will just read as a ~ or !
          let expression = new RegExp(`(\\s|^)${escapeRegExp(searchTerm)}(\\s|$)`, 'gi')
          if (content.search(expression) !== -1) {
            if (!invertedFilter) matches.push(filterType[word])
            else if (invertedFilter) invertedMatches.push(filterType[word])
            results.push({ passed: true, inverted: invertedFilter })
          } else results.push({ passed: false, inverted: invertedFilter })
        }
      }
    } else if (Array.isArray(content)) { // For tags
      for (var item in content) {
        const res = findFilterWords(filterType, content[item])
        results = results.concat(res.resultsList)
        if (res.matches) matches = matches.concat(res.matches)
        if (res.invertedMatches) invertedMatches = invertedMatches.concat(res.invertedMatches)
      }
    }
  } else if (typeof filterType === 'string') {
    const regex = new RegExp(filterType, 'i')
    const found = regex.exec(content)
    if (found) {
      matches.push(found[0])
      results.push({ passed: true, inverted: false })
    } else {
      results.push({ passed: false, inverted: false })
    }
  }

  return {
    resultsList: results,
    matches: matches.length > 0 ? matches : null,
    invertedMatches: invertedMatches.length > 0 ? invertedMatches : null
  }
}

export default (filters, article) => {
  const referenceOverrides = {
    description: article._fullDescription,
    summary: article._fullSummary,
    title: article._fullTitle,
    tags: article.tags ? article.tags.split('\n') : []
  }

  const passed = { // Inverted and regular filters are ultimately calculated together with AND
    invertedFilters: true,
    regularFilters: false
  }
  let regularFiltersExists = false
  let invertedFiltersExists = false

  const filterResults = new _FilterResults()
  for (var filterTypeName in filters) {
    const userFilters = filters[filterTypeName]
    const reference = referenceOverrides[filterTypeName.replace('other:', '')] || article[filterTypeName.replace('other:', '')]

    if (!reference) {
      regularFiltersExists = true
      continue
    }

    const allResults = findFilterWords(userFilters, reference)
    // Get match words for test messages
    if (allResults.matches) filterResults.add(filterTypeName, allResults.matches, false)
    if (allResults.invertedMatches) filterResults.add(filterTypeName, allResults.invertedMatches, true)

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

  if (!invertedFiltersExists && !regularFiltersExists) {
    passed.invertedFilters = true
    passed.regularFilters = true
  } else if (!invertedFiltersExists && regularFiltersExists) passed.invertedFilters = true
  else if (!regularFiltersExists && invertedFiltersExists) passed.regularFilters = true

  filterResults.passed = passed.invertedFilters && passed.regularFilters
  return filterResults
}

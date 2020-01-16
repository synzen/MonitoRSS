const Filter = require('../../structs/Filter.js')
const FilterRegex = require('../../structs/FilterRegex.js')

class _FilterResults {
  constructor () {
    this.matches = {}
    this.invertedMatches = {}
    this.passed = true
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

module.exports = (filters, article) => {
  const referenceOverrides = {
    description: article._fullDescription,
    summary: article._fullSummary,
    title: article._fullTitle
  }

  let passed = true
  const filterResults = new _FilterResults()
  for (const filterTypeName in filters) {
    const userFilters = filters[filterTypeName]
    let reference
    if (filterTypeName.startsWith('raw:')) {
      reference = article.getRawPlaceholderContent(filterTypeName)
    } else {
      reference = referenceOverrides[filterTypeName.replace('other:', '')] || article[filterTypeName.replace('other:', '')]
    }

    if (!reference) {
      continue
    }

    const invertedMatches = []
    const matches = []
    if (Array.isArray(userFilters)) {
      // Array
      for (const word of userFilters) {
        const filter = new Filter(word)
        passed = passed && filter.passes(reference)
        if (filter.inverted) {
          invertedMatches.push(word)
        } else {
          matches.push(word)
        }
      }
    } else {
      // String
      const filter = new FilterRegex(userFilters)
      const filterPassed = filter.passes(reference)
      passed = passed && filterPassed
      if (filterPassed) {
        matches.push(userFilters)
      } else {
        invertedMatches.push(userFilters)
      }
    }

    if (matches.length > 0) {
      filterResults.add(filterTypeName, matches, false)
    }
    if (invertedMatches.length > 0) {
      filterResults.add(filterTypeName, invertedMatches, true)
    }
  }

  filterResults.passed = passed

  return filterResults
}

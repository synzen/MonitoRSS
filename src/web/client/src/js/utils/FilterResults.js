class FilterResults {
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

export default FilterResults

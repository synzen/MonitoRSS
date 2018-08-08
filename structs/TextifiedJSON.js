class TextifiedJSON {
  constructor (data) {
    this.data = data
    this.results = {}
    this.text = ''
    // Populate this.results with a trampoline to avoid stack call exceeded
    this._trampolineIteration(this._iterateOverObject.bind(this), data)
    // Generate the text from this.results
    this._generateText()
  }

  _trampolineIteration (fun, obj, previousKeyNames) {
    for (var key in obj) {
      let val = fun.bind(this)(obj[key], key, previousKeyNames)
      while (typeof val === 'function') {
        val = val()
      }
    }
  }

  _iterateOverObject (item, keyName, previousKeyNames) {
    const keyNameWithPrevious = previousKeyNames ? `${previousKeyNames}.${keyName}` : keyName
    if (Array.isArray(item) || keyName.includes('.') || !item || item === this.results[keyNameWithPrevious.toLowerCase()]) return
    if (Object.prototype.toString.call(item) === '[object Object]') return () => this._trampolineIteration(this._iterateOverObject, item, keyNameWithPrevious)
    else this.results[keyNameWithPrevious] = item
  }

  _generateText () {
    let nameHeader = 'PROPERTY NAME'
    let valueHeader = 'VALUE'
    let longestNameLen = 0
    let longestValLen = 0
    for (let key in this.results) {
      const val = this.data[key]
      if (key.length > longestNameLen) longestNameLen = key.length
      if (val && val.length > longestValLen) longestValLen = val.length
    }

    if (nameHeader.length > longestNameLen) longestNameLen = nameHeader
    if (valueHeader.length > longestValLen) longestValLen = valueHeader
    longestNameLen += 10

    while (nameHeader.length < longestNameLen) nameHeader += ' '
    while (valueHeader.length < longestValLen) valueHeader += ' '

    nameHeader += '|  '
    const header = nameHeader + valueHeader
    let bar = ''
    while (bar.length < header.length) bar += '-'
    this.text = header + '\r\n' + bar + '\r\n'

    // Add in the key/values
    for (let key in this.results) {
      let curStr = key
      while (curStr.length < longestNameLen) curStr += ' '
      const propNameLength = curStr.length
      const valueLines = this.results[key].toString().split('\n')
      for (let u = 0; u < valueLines.length; ++u) {
        curStr += u === 0 ? `|  ${valueLines[u]}\r\n` : `   ${valueLines[u]}\r\n`
        if (u < valueLines.length - 1) {
          let emptyPropName = ''
          while (emptyPropName.length < propNameLength) emptyPropName += ' '
          curStr += emptyPropName
        }
      }
      this.text += curStr
    }
  }

  getValue (str) {
    return this.results[str] || ''
  }
}

module.exports = TextifiedJSON

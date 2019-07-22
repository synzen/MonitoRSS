const idTypeNames = ['guid', 'pubdate', 'title']

class ArticleIDResolver {
  constructor () {
    this.idsRecorded = {}
    this.useIdTypes = {}
    this.mergedTypeNames = [] // An extension of idTypeNames - must be an array to maintain order
    this.failedTypeNames = [] // Keep the order in which they are discarded - in case ALL id types fail, use the last one that failed

    for (let i = 0; i < idTypeNames.length; ++i) {
      const idType = idTypeNames[i]
      this.idsRecorded[idType] = {}
      this.useIdTypes[idType] = true
      for (let j = i + 1; j < idTypeNames.length; ++j) {
        const nextIdType = idTypeNames[j]
        const mergedName = `${idType},${nextIdType}`
        this.idsRecorded[mergedName] = {}
        this.useIdTypes[mergedName] = true
        this.mergedTypeNames.push(mergedName)
      }
    }
  }

  recordArticle (article) {
    const { useIdTypes, idsRecorded } = this
    for (const idType in useIdTypes) {
      if (!useIdTypes[idType]) continue
      const articleValue = this.constructor.getIdTypeValue(article, idType)
      if (!articleValue || idsRecorded[idType][articleValue]) {
        useIdTypes[idType] = false
        this.failedTypeNames.push(idType)
      } else idsRecorded[idType][articleValue] = true
    }
  }

  getIDType () {
    const idTypes = idTypeNames.concat(this.mergedTypeNames)
    for (const idType of idTypes) {
      if (this.useIdTypes[idType]) return idType
    }
    return this.failedTypeNames[this.failedTypeNames.length - 1]
  }

  static getIdTypeValue (article, idType) {
    const properties = idType.split(',')
    return properties.map(property => article[property]).join('')
  }
}

module.exports = ArticleIDResolver

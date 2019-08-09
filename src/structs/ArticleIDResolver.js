const idTypeNames = ['guid', 'pubdate', 'title']

class ArticleIDResolver {
  constructor () {
    this.idsRecorded = {}
    this.useIdTypes = []
    this.failedTypeNames = [] // Keep the order in which they are discarded - in case ALL id types fail, use the last one that failed
    this.failedTypeNamesSet = new Set() // For O(1) access
    this.mergedTypeNames = new Set()

    // Push the merged names first - using multiple properties is more reliable
    for (let i = 0; i < idTypeNames.length; ++i) {
      const idType = idTypeNames[i]
      this.idsRecorded[idType] = {}
      for (let j = i + 1; j < idTypeNames.length; ++j) {
        const nextIdType = idTypeNames[j]
        const mergedName = `${idType},${nextIdType}`
        this.idsRecorded[mergedName] = {}
        this.useIdTypes.push(mergedName)
        this.mergedTypeNames.add(mergedName)
      }
    }

    // Push the single id types at the end
    for (const name of idTypeNames) {
      this.useIdTypes.push(name)
    }
  }

  recordArticle (article) {
    const { useIdTypes, idsRecorded } = this
    // Start from the end, since that's where the non-merged id types are.
    // The single-property id types should be marked failed first to check the merged id types
    for (let i = useIdTypes.length - 1; i >= 0; --i) {
      const idType = useIdTypes[i]
      if (this.failedTypeNamesSet.has(idType)) continue

      if (this.mergedTypeNames.has(idType)) {
        const individualIDTypes = idType.split(',')
        for (const singleIDType of individualIDTypes) {
          if (this.failedTypeNamesSet.has(singleIDType) && !this.failedTypeNamesSet.has(idType)) {
            this.failedTypeNames.push(idType)
            this.failedTypeNamesSet.add(idType)
          }
        }
        if (this.failedTypeNamesSet.has(idType)) continue
      }

      const articleValue = ArticleIDResolver.getIDTypeValue(article, idType)
      if (!articleValue || idsRecorded[idType][articleValue]) {
        // If the article value doesn't exist, or was already seen for this id type, then don't use it
        this.failedTypeNames.push(idType)
        this.failedTypeNamesSet.add(idType)
      } else {
        idsRecorded[idType][articleValue] = true
      }
    }
  }

  getIDType () {
    for (const idType of this.useIdTypes) {
      if (!this.failedTypeNamesSet.has(idType)) return idType
    }
    for (let i = this.failedTypeNames.length - 1; i >= 0; --i) {
      const idType = this.failedTypeNames[i]
      if (this.mergedTypeNames.has(idType)) return idType
    }
    // return this.failedTypeNames[this.failedTypeNames.length - 1]
  }

  static getIDTypeValue (article, idType) {
    const properties = idType.split(',')
    return properties.map(property => article[property] || '').join('')
  }
}

module.exports = ArticleIDResolver

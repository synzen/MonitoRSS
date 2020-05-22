class ArticleIDResolver {
  constructor () {
    /**
     * Object of placeholder types as keys and sets of article values to see if such values were seen before.
     * If a article value was seen before in this set, then that placeholder should be made invalid
     * @type {Object<string, Set<string>>}
     * */
    this.idsRecorded = {}

    /**
     * Initially holds all possible ID types after instantiation. ID types are removed as articles are recorded.
     * @type {Set<string>}
     * */
    this.useIdTypes = new Set()

    /**
     * Holds the merged ID types.
     * @type {Array<string>}
     * */
    this.mergedTypeNames = [] // An extension of idTypeNames - must be an array to maintain order

    /**
     * Placeholders that should not be used. Array is used to maintain the order in which they fail.
     * In case all possible placeholders fail, then use the last one that failed.
     * @type {Array<string>}
     */
    this.failedTypeNames = []

    const typeNames = ArticleIDResolver.ID_TYPE_NAMES
    for (let i = 0; i < typeNames.length; ++i) {
      const idType = typeNames[i]
      this.idsRecorded[idType] = new Set()
      this.useIdTypes.add(idType)
      for (let j = i + 1; j < typeNames.length; ++j) {
        const nextIdType = typeNames[j]
        const mergedName = `${idType},${nextIdType}`
        this.idsRecorded[mergedName] = new Set()
        this.useIdTypes.add(mergedName)
        this.mergedTypeNames.push(mergedName)
      }
    }
  }

  static get ID_TYPE_NAMES () {
    return ['guid', 'pubdate', 'title']
  }

  /**
   * A function that would be repeatedly called for every article in a feed to determine
   * the ID that should be used. ID types that have duplicate values for multiple articles
   * are invalidated.
   * @param {Object} article - The raw article object
   */
  recordArticle (article) {
    const { useIdTypes, idsRecorded } = this
    useIdTypes.forEach(idType => {
      const articleValue = ArticleIDResolver.getIDTypeValue(article, idType)
      if (!articleValue || idsRecorded[idType].has(articleValue)) {
        useIdTypes.delete(idType)
        this.failedTypeNames.push(idType)
      } else {
        idsRecorded[idType].add(articleValue)
      }
    })
  }

  /**
   * Returns the first valid id type
   * @returns {string}
   */
  getIDType () {
    const idTypes = ArticleIDResolver.ID_TYPE_NAMES.concat(this.mergedTypeNames)
    for (const idType of idTypes) {
      if (this.useIdTypes.has(idType)) {
        return idType
      }
    }
    return this.failedTypeNames[this.failedTypeNames.length - 1]
  }

  /**
   * Get the article's value of an ID type. Auto-resolves the value for merged id types.
   * @param {Object} article - The raw article object
   * @param {string} idType - The ID type
   */
  static getIDTypeValue (article, idType) {
    const properties = idType.split(',')
    return properties.map(property => article[property]).join('')
  }
}

module.exports = ArticleIDResolver

/**
 * Resolves the best ID type to use for articles in a feed.
 * Prevents duplicate IDs by tracking seen values and invalidating
 * ID types that have duplicates.
 */
export class ArticleIDResolver {
  /**
   * Object of placeholder types as keys and sets of article values to see if such values were seen
   * before. If an article value was seen before in this set, then that placeholder should be made
   * invalid.
   */
  idsRecorded: Record<string, Set<string>> = {};

  /**
   * Initially holds all possible ID types after instantiation. ID types are removed as articles
   * are recorded.
   */
  useIdTypes = new Set<string>();

  /**
   * Holds the merged ID types.
   */
  mergedTypeNames: string[] = [];

  /**
   * Placeholders that should not be used. Array is used to maintain the order in which they fail.
   * In case all possible placeholders fail, then use the last one that failed.
   */
  failedTypeNames: string[] = [];

  static get ID_TYPE_NAMES(): string[] {
    return ["guid", "pubdate", "title"];
  }

  constructor() {
    const typeNames = ArticleIDResolver.ID_TYPE_NAMES;

    for (let i = 0; i < typeNames.length; ++i) {
      const idType = typeNames[i]!;
      this.idsRecorded[idType] = new Set();
      this.useIdTypes.add(idType);

      for (let j = i + 1; j < typeNames.length; ++j) {
        const nextIdType = typeNames[j]!;
        const mergedName = `${idType},${nextIdType}`;
        this.idsRecorded[mergedName] = new Set();
        this.useIdTypes.add(mergedName);
        this.mergedTypeNames.push(mergedName);
      }
    }
  }

  /**
   * Get the article's value of an ID type. Auto-resolves the value for merged id types.
   */
  static getIDTypeValue(
    article: Record<string, unknown>,
    idType: string
  ): string {
    const properties = idType.split(",");

    return properties.map((property) => article[property]).join("");
  }

  /**
   * A function that would be repeatedly called for every article in a feed to determine
   * the ID that should be used. ID types that have duplicate values for multiple articles
   * are invalidated.
   */
  recordArticle(article: Record<string, unknown>) {
    const { useIdTypes, idsRecorded } = this;

    useIdTypes.forEach((idType) => {
      const articleValue = ArticleIDResolver.getIDTypeValue(article, idType);
      const recorded = idsRecorded[idType];

      if (!articleValue || !recorded || recorded.has(articleValue)) {
        useIdTypes.delete(idType);
        this.failedTypeNames.push(idType);
      } else {
        recorded.add(articleValue);
      }
    });
  }

  /**
   * Returns the first valid id type
   */
  getIDType(): string | undefined {
    const idTypes = ArticleIDResolver.ID_TYPE_NAMES.concat(
      this.mergedTypeNames
    );

    for (const idType of idTypes) {
      if (this.useIdTypes.has(idType)) {
        return idType;
      }
    }

    return this.failedTypeNames[this.failedTypeNames.length - 1];
  }
}

import { Entity, MikroORM, PrimaryKey, Property } from "@mikro-orm/core";

@Entity({
  collection: 'general_stats'
})
class GeneralStat {

  @PrimaryKey()
  _id: string;

  @Property()
  data: string|number;

  @Property()
  addedAt = new Date()

  static keys = {
    ARTICLES_SENT: 'articlesSent',
    ARTICLES_BLOCKED: 'articlesBlocked'
  }

  constructor(id: string, data: string|number) {
    this._id = id
    this.data = data
  }

  /**
   * Atomically increase a particular numeric stat by 1
   */
  static async increaseNumericStat (orm: MikroORM, key: string) {
    const c = await orm.em.findOne(this, {
      _id: key
    })
    if (!c) {
      const stat = new GeneralStat(key, 1)
      await orm.em.insert(stat)
    } else {
      await orm.em.nativeUpdate(this, {
        _id: key
      }, {
        data: Number(c.data) + 1
      })
    }
  }
}

export default GeneralStat

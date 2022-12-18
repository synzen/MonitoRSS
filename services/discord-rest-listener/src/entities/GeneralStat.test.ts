import { MikroORM } from "@mikro-orm/core"
import testConfig from "../utils/testConfig"
import GeneralStat from "./GeneralStat"

jest.useFakeTimers()

describe('GeneralStat', () => {
  let orm: MikroORM
  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [GeneralStat],
      type: 'mongo',
      clientUrl: testConfig.databaseURI,
    })
  })
  beforeEach(async () => {
    await orm.em.getRepository(GeneralStat).nativeDelete({})
  })
  afterAll(async () => {
    await orm.close(true)
  })
  describe('increaseNumericCount', () => {
    it('sets 1 for a stat that does not exist', async () => {
      await GeneralStat.increaseNumericStat(orm, 'sumting')
      const found = await orm.em.findOne(GeneralStat, 'sumting')
      expect(found).toBeDefined()
      expect(found?.data).toEqual(1)
    })
    it('adds 1 for a stat that does exist', async () => {
      const statId = 'statexists'
      await orm.em.nativeInsert(GeneralStat, {
        _id: statId,
        data: 100
      })
      await GeneralStat.increaseNumericStat(orm, statId)
      const found = await orm.em.findOne(GeneralStat, statId)
      expect(found).toBeDefined()
      expect(found?.data).toEqual(101)
    })
  })
})
